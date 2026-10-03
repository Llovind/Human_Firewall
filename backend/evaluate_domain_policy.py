"""Offline runtime-policy evaluation; no URL fetches or training/threshold fits."""
import argparse
import csv
import json
from pathlib import Path

import numpy as np
from services import domain_scanner
from services.proxy_service import normalize_domain
from train_domain_model import distinct_domain_labels, load, upper_error


def evaluate(rows):
    model = domain_scanner._model  # evaluated local artifact, never user uploads
    margins = model['pipeline'].decision_function([row[0] for row in rows]).reshape(-1, 1)
    probabilities = model['calibrator'].predict_proba(margins)[:, 1]
    rows, probabilities = distinct_domain_labels(rows, probabilities)
    y = np.array([row[1] for row in rows])
    abstained = np.array([domain_scanner.generated_hostname(row[0]) for row in rows])
    threshold = domain_scanner._manifest['block_threshold']
    blocked = (probabilities >= threshold) & ~abstained if domain_scanner._manifest['enforcement_eligible'] else np.zeros(len(y), dtype=bool)
    fp, tp = int(((y == 0) & blocked).sum()), int(((y == 1) & blocked).sum())
    negatives, positives = int((y == 0).sum()), int((y == 1).sum())
    return {'domain_label_observations': len(rows), 'benign': negatives, 'malicious': positives,
        'block_false_positives': fp, 'block_true_positives': tp,
        'block_fpr': fp / negatives if negatives else None,
        'block_fpr_95pct_upper': upper_error(fp, negatives) if negatives else None,
        'block_precision': tp / (tp + fp) if tp + fp else None,
        'block_recall': tp / positives if positives else None,
        'generated_hostname_abstentions': int(abstained.sum()),
        'unknown_fraction': float(((~blocked & (probabilities > .1)) | abstained).mean())}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Do not overwrite recorded evaluations')
    domain_scanner.warmup()
    if domain_scanner._model is None:
        raise RuntimeError('Model unavailable')
    rows, rejected = load(args.dataset / 'test.csv')
    report = {'modelVersion': domain_scanner.model_version(), 'test_invalid_rejected': rejected,
        'test_runtime_policy': evaluate(rows),
        'limitations': ['Reused holdout: not an independent new generalization test',
                        'OOD case study is internal seed data, not verified current malicious sites',
                        'No adult-content labels; gambling is separate from phishing/malware']}
    categories = {}
    with (args.dataset / 'indonesian_threat_casestudy.csv').open(encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            host = normalize_domain(row['url'])
            categories.setdefault(row['threat_category'], []).append((host, int(row['is_malicious']), host))
    report['ood_seed_by_category'] = {category: evaluate(rows) for category, rows in categories.items()}
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
