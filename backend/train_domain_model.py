"""Train/evaluate a domain-only candidate offline; never fetch dataset URLs.

Training uses train.csv only. val.csv is split by registered domain into
calibration and threshold-policy subsets. Frozen test.csv is evaluated once;
it never fits vocabulary, coefficients, calibration, or thresholds.
"""
import argparse
import csv
import hashlib
import json
import math
import time
from collections import Counter, defaultdict
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.pipeline import make_pipeline

from services.proxy_service import normalize_domain, ProxyError


def load(path):
    rows = []
    rejected = 0
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                host = normalize_domain(row["url"])
            except (ProxyError, ValueError):
                rejected += 1
                continue  # counted, not silently repaired or fetched
            label = int(row["is_malicious"])
            if label not in (0, 1):
                raise ValueError("Non-binary dataset label")
            rows.append((host, label, row["registered_domain"].lower().rstrip(".") or host))
    return rows, rejected


def upper_error(count, total):
    """95% Wilson upper bound: zero observed errors does not mean zero risk."""
    if total == 0:
        return 1.0
    z, p = 1.96, count / total
    return (p + z*z/(2*total) + z*math.sqrt(p*(1-p)/total + z*z/(4*total*total))) / (1 + z*z/total)


def select_threshold(y, probabilities, budget):
    # Select highest recall under the policy-validation FPR upper-bound budget.
    # >= comparison accounts for tied calibrated scores (no optimistic slicing).
    negatives = int((y == 0).sum())
    best = None
    for threshold in np.unique(probabilities):
        selected = probabilities >= threshold
        fp = int(((y == 0) & selected).sum())
        tp = int(((y == 1) & selected).sum())
        if tp and upper_error(fp, negatives) <= budget:
            candidate = (tp, -fp, float(threshold))
            if best is None or candidate > best:
                best = candidate
    return best[2] if best else None


def metrics(rows, probabilities, threshold):
    y = np.array([r[1] for r in rows])
    blocked = probabilities >= threshold if threshold is not None else np.zeros(len(y), dtype=bool)
    fp, tp = int(((y == 0) & blocked).sum()), int(((y == 1) & blocked).sum())
    negatives, positives = int((y == 0).sum()), int((y == 1).sum())
    return {"rows": len(rows), "unique_domains": len({r[0] for r in rows}),
        "benign": negatives, "malicious": positives,
        "binary_accuracy_at_0_5": float(accuracy_score(y, probabilities >= 0.5)),
        "roc_auc": float(roc_auc_score(y, probabilities)),
        "block_false_positives": fp, "block_true_positives": tp,
        "block_fpr": fp / negatives if negatives else None,
        "block_fpr_95pct_upper": upper_error(fp, negatives),
        "block_precision": tp / (tp + fp) if tp + fp else None,
        "block_recall": tp / positives if positives else None,
        "unknown_fraction": float((~blocked & (probabilities > 0.1)).mean())}


def distinct_domain_labels(rows, probabilities):
    # Repeated URL paths on one host are not independent domain decisions.
    # Retain both labels for mixed hosts: one benign path is enough to count
    # a whole-domain block as a false positive for that host.
    unique = {(r[0], r[1]): (r, float(p)) for r, p in zip(rows, probabilities)}
    return [v[0] for v in unique.values()], np.array([v[1] for v in unique.values()])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=Path(__file__).resolve().parent.parent / "dataset/processed")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent / "models/domain_v1")
    parser.add_argument("--fpr-budget", type=float, default=0.01)
    args = parser.parse_args()
    if not 0 < args.fpr_budget < 0.1:
        raise ValueError("Use a realistic low FPR budget in (0, 0.1)")
    if args.output.exists():
        raise ValueError("Candidate output already exists; do not overwrite evaluated artifacts")
    loaded = {name: load(args.dataset / f"{name}.csv") for name in ("train", "val", "test")}
    splits = {name: value[0] for name, value in loaded.items()}
    groups = {name: {r[2] for r in rows} for name, rows in splits.items()}
    overlaps = {f"{a}/{b}": len(groups[a] & groups[b]) for a, b in (("train", "val"), ("train", "test"), ("val", "test"))}
    if any(overlaps.values()):
        raise ValueError(f"Registered-domain leakage across supplied splits: {overlaps}")
    labels = defaultdict(set)
    for host, label, _ in splits["train"]:
        labels[host].add(label)
    training = [(host, next(iter(values))) for host, values in sorted(labels.items()) if len(values) == 1]
    calibration, policy = [], []
    for row in splits["val"]:
        bucket = int(hashlib.sha256(row[2].encode()).hexdigest()[:8], 16) % 2
        (calibration if bucket == 0 else policy).append(row)
    if any(len({r[1] for r in rows}) != 2 for rows in (training, calibration, policy, splits["test"])):
        raise ValueError("Both classes are required in each training/evaluation subset")
    started = time.perf_counter()
    pipeline = make_pipeline(
        TfidfVectorizer(analyzer="char", ngram_range=(2, 5), min_df=2, max_features=150000, sublinear_tf=True),
        LogisticRegression(C=4, solver="liblinear", max_iter=500, class_weight="balanced", random_state=42),
    )
    pipeline.fit([r[0] for r in training], [r[1] for r in training])
    # Calibration preserves mixed-label domains instead of pretending a path-
    # dependent threat can always be identified from its hostname.
    calibrator = LogisticRegression(C=1, random_state=42)
    margins = pipeline.decision_function([r[0] for r in calibration]).reshape(-1, 1)
    counts = Counter(r[0] for r in calibration)
    calibrator.fit(margins, [r[1] for r in calibration], sample_weight=[1/counts[r[0]] for r in calibration])

    def predict(rows):
        margins = pipeline.decision_function([r[0] for r in rows]).reshape(-1, 1)
        return calibrator.predict_proba(margins)[:, 1]

    policy_prob = predict(policy)
    policy_domains, policy_domain_prob = distinct_domain_labels(policy, policy_prob)
    threshold = select_threshold(np.array([r[1] for r in policy_domains]), policy_domain_prob, args.fpr_budget)
    # Evaluate full original holdout rows, including mixed-label domains.
    # Accuracy at 0.5 is descriptive, not the blocking policy's operating point.
    test_prob = predict(splits["test"])
    test_domains, test_domain_prob = distinct_domain_labels(splits["test"], test_prob)
    report = {"feature_scope": "domain", "seed": 42, "registered_domain_overlap": overlaps,
        "invalid_hostname_rows_rejected": {name: value[1] for name, value in loaded.items()},
        "training_unique_domains": len(training),
        "training_mixed_label_domains_excluded": sum(len(values) > 1 for values in labels.values()),
        "calibration_rows": len(calibration), "block_threshold": threshold,
        "fpr_budget": args.fpr_budget, "policy_validation": metrics(policy, policy_prob, threshold),
        "policy_unique_domain_labels": metrics(policy_domains, policy_domain_prob, threshold),
        "test": metrics(splits["test"], test_prob, threshold),
        "test_unique_domain_labels": metrics(test_domains, test_domain_prob, threshold),
        "training_seconds": time.perf_counter() - started,
        "dataset_sha256": {name: hashlib.sha256((args.dataset / f"{name}.csv").read_bytes()).hexdigest() for name in splits},
        "limitations": ["No TLS/content/path inspection", "No pornography category", "Row-level URL labels projected onto domain-only scores", "Holdout corpus is not a real-world traffic distribution"]}
    # Holdout is a release safety check, not a threshold-tuning source.
    eligible = threshold is not None and report["test_unique_domain_labels"]["block_fpr_95pct_upper"] <= args.fpr_budget
    report["enforcement_eligible"] = eligible
    if not eligible:
        report["release_note"] = "Candidate remains review-only: holdout FPR gate failed or no block threshold"
    args.output.mkdir(parents=True)
    artifact = args.output / "classifier.joblib"
    joblib.dump({"pipeline": pipeline, "calibrator": calibrator}, artifact, compress=3)
    report["artifact_sha256"] = hashlib.sha256(artifact.read_bytes()).hexdigest()
    version_bytes = artifact.read_bytes() + json.dumps({"block_threshold": threshold, "eligible": eligible}, sort_keys=True).encode()
    report["model_version"] = "domain-tfidf-lr-v1-" + hashlib.sha256(version_bytes).hexdigest()[:12]
    latency = []
    for host in [r[0] for r in splits["test"][:100]]:
        before = time.perf_counter()
        predict([(host, 0, host)])
        latency.append((time.perf_counter() - before) * 1000)
    report["cpu_inference_ms"] = {"p50": float(np.percentile(latency, 50)), "p95": float(np.percentile(latency, 95))}
    (args.output / "manifest.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
