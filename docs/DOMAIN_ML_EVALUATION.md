# Domain-only ML: offline baseline, 2 October 2026

## Current demo policy — 3 October 2026

The historical v2 numbers below are superseded by v3's **operating point**.
The training/calibration data and fitted coefficients are unchanged; this is
not a new architecture or evidence of higher general classification accuracy.
Validation FPR budget was tightened from 1% to 0.3%, choosing threshold
0.9659728579361835 on validation only. Model directory: `domain_v3`.

Runtime abstains to Unknown for subdomain labels containing long hex IDs.
This is a deliberate conservative heuristic, not an infrastructure whitelist.
It also misses threats with that shape; SOC policy still takes precedence.
Old local-model verdicts are ignored by policy version, in both the request
gate and active-tunnel controller. Historical observations/audit remain.

| Runtime measure on the existing test corpus | v3 result |
| --- | ---: |
| Benign / malicious domain-label observations | 3,062 / 4,217 |
| False block predictions | 3 (previously 17) |
| Block false-positive rate | 0.098% |
| Block precision | 99.67% |
| Block recall | 21.18% (893 / 4,217) |
| Unknown fraction | 86.73% |
| Approximate FPR 95% upper bound | 0.288% |
| Warm model-only inference p50 / p95 | 0.77 / 1.31 ms |

The holdout has been reused for release checks across revisions. These are
not independent new generalization results. Real employee traffic is a
different distribution; neither zero false positives nor instant network
latency is guaranteed. Evidence: `models/domain_v3/manifest.json` and
`runtime_policy_evaluation.json`; rerun using `evaluate_domain_policy.py`.

The internal OOD seed has 70 unique labelled judol hosts: **0/70 autoblocked**
at this operating point. The seed is not proof of current live site categories.
No pornography category exists in the training data. These are outstanding
coverage gaps, not completed features. A `.com` wildcard, popular-domain
whitelist, keyword block, or pretending category policy is phishing ML would
conceal the problem rather than validate it. See `REVIEW_FIXES.md` for data
requirements. Manual SOC category blocks remain available for the demo.

## Historical v2 baseline

The proxy sees the CONNECT hostname, not HTTPS paths/content. Training a
domain-only baseline is safer than applying the old URL DL's calibration to
an input distribution it was not evaluated on. The URL Char-BiLSTM weights
and calibrators were preserved; they remain usable for explicitly submitted
full URLs, not live HTTPS content inspection.

## Protocol

- Source: team dataset in `dataset/processed`, commit `6221f13`.
- Train: 32,519 unique, consistent binary-labelled domains from train.csv.
- 37 mixed benign/malicious training hosts excluded; evaluation still includes
  mixed labels, because paths on the same host can have different labels.
- Invalid hostnames rejected and counted: train 7, validation 3, test 4.
- Registered-domain overlap between train/val/test: zero.
- Features: hostname character TF-IDF 2..5 grams, Logistic Regression, Platt
  calibration fitted on one deterministic registered-domain half of val.csv.
- Block threshold 0.9069678669935356 selected on the other validation half to
  keep the approximate 95% Wilson FPR upper bound below 1% per unique domain.
- test.csv never fits vocabulary, coefficients, calibration, or threshold.
  It is a release check, not a tuning source. An initial row-weighted draft
  was re-evaluated with unique-domain counting to avoid treating repeated paths
  as independent decisions. This holdout has therefore been inspected twice;
  future model selection requires a new untouched/temporal test set.
- No dataset URL was opened, fetched, scraped, or sent to a provider.

## Observed results (unique-domain binary labels)

| Measure | Result |
| --- | ---: |
| Unique test domains | 7,275 |
| Benign/malicious domain-label observations | 3,062 / 4,217 |
| Binary accuracy at diagnostic threshold 0.5 | 73.20% |
| ROC AUC | 0.8214 |
| Block precision at deployed conservative threshold | 98.72% |
| Block false-positive rate | 0.56% (17 / 3,062) |
| Approximate FPR 95% upper bound | 0.89% |
| Block recall | 30.99% (1,307 / 4,217) |
| Unknown fraction | 80.85% |
| CPU inference p50 / p95, 100 warmed single-domain calls | 0.70 / 1.04 ms |

The inference timing excludes Flask, Redis/PostgreSQL, relay/Squid, network,
queueing and certificate generation. It is **not** end-to-end access latency.
The FPR estimate is corpus-specific, not a guarantee for new browsing traffic;
related domains and dataset-source imbalance limit independence assumptions.

The high precision applies **only to Block predictions**. Most threats do not
meet the conservative Block threshold; recall is low. Do not claim 98.72%
overall accuracy, complete malicious-site coverage, or pornography detection.
Completed Unknown predictions remain allowed for review by agreement. Pending
and unavailable inference are temporarily denied, without poisoning blacklist.

Full machine-readable results, dataset checksums, artifact checksum and model
version are in `backend/models/domain_v2/manifest.json`. The joblib artifact is
trusted local code/data and must not be replaced with an untrusted upload.

## Reproducible training

Inside the backend runtime with the dataset mounted at `/dataset`:

```text
python train_domain_model.py --dataset /dataset --output /app/models/new_candidate
```

Use a new output directory; the script refuses to overwrite an evaluated
artifact. `ML_DOMAIN_MODEL_DIR` selects the deployed candidate. A failed FPR
release gate leaves malicious scores review-only. No `.com` wildcard whitelist
or external intelligence override improves these evaluation numbers.
