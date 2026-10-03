# Local LLM experiment and dataset audit

Evidence date: 3 October 2026. Offline classification only; no dataset URLs were visited and no proxy policies were changed.

## Decision

- Fine-tuned candidates `hostname_v1` and `hostname_v2`: **do not activate**. Both failed quality gates. Native v1 quantized inference also failed; v2 runtime export/import testing is deferred because quality already failed.
- Additional `agent_sft_dataset_af.jsonl`: **hold for label/provenance review**, not direct training. Daf subsequently supplied its generator: it samples an existing CSV and builds rule-generated explanations; it does not scrape page content. The underlying CSV ground truth still needs independent provenance.
- Application: existing `qwen3:4b-instruct-2507-q4_K_M`, JSON output, explicit SOC request, **advisory-only**. This baseline is not the fine-tuned candidate and has no demonstrated high-accuracy claim.

## Completed fine-tuning

Base: `Qwen/Qwen3-0.6B`, revision `c1899de289a04d12100db370d81485cdf75e47ca`. QLoRA NF4, rank 8, 2,293,760 trainable parameters. Hardware: RTX 3070 Laptop GPU, 8 GB VRAM. Input is hostname only; output is one class token, not a generated explanation, risk percentage or Block/Allow instruction.

Sources: repository benign/phishing/malware CSVs and Daf's category CSV. Confirmed category mapping: 0 benign, 1 gambling, 2 adult; 1,100 streaming rows (label 3) excluded. Ambiguous repository `other` labels excluded. Conflicting hostname labels map to Unknown.

Registered-domain grouping prevents overlap between this experiment's fine-tuning train/validation/test splits. It does not prove absence of base-model pretraining exposure or overlap with earlier project ML experiments. Source hashes and exclusions are recorded in `ml/artifacts/hostname_v1_data/dataset_manifest.json`.

- Samples: 4,383 train, 806 validation, 1,162 frozen test.
- Training: 190 optimizer steps, 901 seconds; recorded elapsed time through evaluation: 1,087 seconds (CPU merge/export is additional).
- Peak PyTorch-allocated VRAM: 2,975 MiB. This excludes driver/allocator/desktop overhead and is not total GPU memory consumption.

| Metric | Validation | Frozen test |
| --- | ---: | ---: |
| Accuracy | 61.41% | 61.10% |
| Macro-F1 | 0.3908 | 0.4073 |
| Benign false-flag rate | 14.50% (58/400) | 14.33% (86/600) |
| Phishing recall | 44% | 26% |
| Malware recall | 1% | 2% |
| Gambling recall | 55% | 50% |
| Adult recall | 53% | 52% |

Frozen-test benign false-flag Wilson 95% interval: **11.76–17.36%**. A false flag here means a benign sample classified as a threat category, not an actual network block. Test accuracy is not calibrated confidence or real-world precision.

Predeclared validation gates: macro-F1 >=0.60, improvement over the untrained baseline, phishing/gambling/adult recall >=0.50 each, and benign false-flag rate <=1%. The untrained 0.6B baseline predicted all validation samples benign: 0% false flags but 0% threat recall. Neither baseline nor candidate meets the intended detection goal. Evaluation: `ml/artifacts/hostname_v1/evaluation.json`.

Native Ollama 0.35.1 INT4 import created a 646 MB candidate, but generation failed with `MLX not available`. `runtime_check.py` terminated before its first result; **no quantized holdout or latency measurements exist**. No application switch was made. Fixing export alone would not make this candidate pass its quality gate.

Active 4B baseline smoke check: an initial request hit the 45-second timeout during cold loading; a subsequent warm `microsoft.com` request completed in 464 ms with advisory-only output and no confidence percentage. This single warm sample is **not p95, an accuracy evaluation, or an instant-response guarantee**. Advice remains outside the proxy enforcement path.

## Additional JSONL audit

File: `C:\Users\dafag\Downloads\agent_sft_dataset_af.jsonl`.

SHA-256: `3c05e82a3a8bdaa82a9bf2933407df66b7e17226460fa18cba6c5e6b9be2f67b`.

- 1,000 rows; 940 valid hostname examples, 60 rejected by the hostname/structure boundary.
- **All 940 valid URLs already exist in the repository CSVs. All 678 unique valid hostnames are also existing data. Zero new hostnames.** This describes input overlap, not proof of how the file was generated.
- Valid examples: 498 benign, 126 phishing, 178 malware, 138 ambiguous `THREAT_OTHER`; no gambling/adult examples.
- All 940 valid inputs contain `Char-BiLSTM Score: 0.5000`. Output risk scores are only 0.85 (442 threat examples) and 0.20 (498 benign examples); these are not calibrated probabilities.
- 160 threat explanations mention an inactive domain or DNS failure. Unavailability alone does not establish maliciousness; those rationales are not trusted training targets.
- 833 valid examples contain a URL path/query. A path-specific threat label cannot automatically become a whole-domain label, especially on shared hosting.
- Existing frozen experiment overlap: exact hostnames train 44 / validation 8 / test 2; registered-domain groups train 58 / validation 10 / test 3. Mixing these rows into training would contaminate the existing holdout.

Audit output: `ml/artifacts/agent_dataset_audit_v2.json`; script: `ml/local_llm/audit_agent_dataset.py`. Original input and previous evaluation artifacts were not overwritten. Attached system/user messages are treated as data, never executed instructions. No new fine-tuning was run on this JSONL.

### Supplied generator review

Daf provided the generator in the attachment `88fdb299-044c-4e4e-a016-c733604ce10f/Pasted text.txt`. It was read as source evidence, **not executed**: no domain sockets, scraping, DL inference on its URLs, or output overwrites were performed.

1. `CSV_PATH` points to `dataset/processed/test.csv`; labels are copied from `is_malicious`/`label`. The script does not retrieve HTML or establish new labels. Reusing a test set for fine-tuning would invalidate evaluation on that set.
2. It calls `scan_url_dl(url)` but reads `scan_res.get("score", 0.50)`. The current repository API returns `p_malicious`, not `score`, so a successful current-API result still falls back to 0.50. On import failure the mock also returns 0.50; an unavailable model returns `None` and would instead fail on `.get`. The supplied JSONL's constant score cannot be accepted as measured model evidence. The file alone does not establish which code version/environment produced it.
3. `max(p_bilstm, 0.85)` for threats and `min(p_bilstm, 0.20)` for benign rows manufacture the risk scores. These are not calibrated confidence; correcting a field name would not validate them.
4. The liveness check is only an IPv4 TCP connection to port 80 with a 0.8-second timeout. It does not verify an HTTP response, HTTPS/TLS or actual page content; HTTPS-only sites, firewalls, IPv6-only hosts or transient failures can appear inactive. Mapping failure to a phishing explanation is unjustified. An `https` string is likewise not proof of a valid certificate or site safety.
5. Keyword/TLD checks create explanations conditioned on the existing label. They do not independently confirm phishing, gambling or adult content. Legitimate login/account pages and shared hosting can match those keywords. The non-seeded sampling also makes exact reproduction harder.

This clarifies **how features/reasons are generated**, not independent truth for those labels. The decision remains unchanged: keep the file for format/reference review, not as additional domain-training examples or trusted explanations. Do not infer new gambling/adult category labels from keyword hits.

## Data that would help next

Provide independently verified, newly collected examples with `url`, `label`, `source`, `verified_at` and whether the label applies to the entire hostname or only a URL path. Include representative benign infrastructure/CDN/authentication/shared-hosting traffic, not only threatening-looking strings; include confirmed gambling/adult domains. Keep streaming separate. Remove generated reasons, fixed risk scores and unsupported liveness claims from the target labels.

Start a separately versioned, registered-domain-grouped experiment; do not recycle the already-inspected v1 test set to choose hyperparameters. Measure quality and warm/cold runtime separately before activation. More steps or repeated copies of existing rows cannot be assumed to improve false positives.

## V2 data preparation and training protocol

The corrected generator replaces the supplied rule-generated SFT script; it does not execute it or repair fabricated scores by substituting another constant. No DL score is needed for the runtime's hostname-only input, so the inconsistent `score` lookup and mock are eliminated entirely from the training flow.

- Only repository `train.csv` supplies labels; original validation/test groups and prior v1 validation/test groups are excluded from all new splits.
- 12,432 historical registered-domain groups reserved. Between v2 splits: zero registered-domain overlap.
- 35,143 path-specific source labels not inherited as domain-category labels. If no eligible root example exists for a hostname, it is labeled Unknown for insufficient scope. This is a conservative **scope annotation**, not a new reputation finding.
- 4,075 source rows excluded for historical evaluation-domain overlap; 9,014 invalid/IP inputs excluded; 17,598 ambiguous repository `other` rows and 1,100 streaming rows excluded.
- `hostname_v2_scope_data`: 4,319 train, 791 validation, 1,151 frozen test examples. Class counts and source/artifact hashes are in its `dataset_manifest.json`. An earlier root-only preparation is preserved separately and was not trained.
- Standard SFT exports contain only the shared system prompt, hostname input and one-letter class target. Original JSONL explanations, fixed risk scores, liveness claims and Block/Allow targets are not imported.
- Five offline regression checks pass: untrusted JSONL audit, hostname boundaries, reproducible preparation/leak/tamper guards, insufficient-support rejection and statistical/recall quality gates.

Training is bounded to one fresh-base QLoRA run, at most 300 optimizer steps or 15 training minutes (evaluation/export extra), using the already-cached pinned base model. The dataset guard runs before weights are loaded. No active application model/policy changes are allowed merely because preparation or training finishes.

V2 gates additionally require >=400 benign and >=30 samples per threat category in each holdout, >=50% recall for **every** threat category (including malware), macro-F1 >=0.60 and a Wilson 95% benign false-flag upper bound <=1%. This strengthens the earlier gate; it does not revise v1 results. V1/v2 test cohorts differ, so their percentages are **not a like-for-like accuracy comparison**.

### Completed v2 results

The run completed successfully: 215 optimizer steps, 900 training seconds, 1,034 recorded seconds through evaluation (CPU merge/export additional). Peak PyTorch-allocated GPU memory: 2,945 MiB, not total device use. Adapter, evaluation and merged weights are saved under `ml/artifacts/hostname_v2`; the container exited 0 without OOM.

| Metric | Validation (791) | Frozen test (1,151) |
| --- | ---: | ---: |
| Accuracy | 64.60% | 66.64% |
| Macro-F1 | 0.4063 | 0.4101 |
| Benign false-flag rate | 12.25% (49/400) | **11.50% (69/600)** |
| Phishing recall | 67.00% | 59.33% |
| Malware recall | **0%** | **0%** |
| Gambling recall | 27.00% | 30.67% |
| Adult recall | 66.00% | 68.24% |
| Unknown-scope recall | 0% | 0% |

Frozen-test benign false-flag Wilson 95% interval: **9.19–14.30%**. Validation macro-F1 improved over the **same-cohort untrained** 0.6B baseline (0.1120), but both quality gates remain **false**. The model emits no Unknown predictions; this is not an improvement in safety, because it is misclassifying insufficient-scope examples instead of learning abstention.

**Not promoted, not imported into Ollama, no latency claim.** Existing application settings retain the unmodified 4B advisory baseline. The review worker was restarted after the completed export; no account, telemetry, report or policy data was removed. Do not lower thresholds or recycle the inspected v2 holdout to obtain a passing score. Better independently verified hostname-scope data and separate future evaluation are needed before another deployment candidate can be considered.

The actual `qualityGate` fields in the v2 evaluation include the Wilson-upper-bound requirement; its inherited generic limitation text about a point-estimate-only gate is stale. The trainer's wording has been corrected for future runs, while this historical evaluation is preserved. Neither wording nor an internal Wilson interval proves real-world performance.

Restoration verified: all ten Compose services healthy, active model still 4B/JSON, and a warm advisory-only smoke request completed in 689 ms with null confidence. This single request is not a latency percentile or accuracy benchmark.

## Verification

- Offline regression checks malformed messages, IP rejection, duplicates, registered-domain leakage and refusal to overwrite evidence: passed.
- Actual supplied file audited without browsing its URLs: passed.
- Active model/mode checked directly in the running backend; baseline generation checked after warm-up. No secrets printed and no live account/report/policy inserted by the smoke check.
