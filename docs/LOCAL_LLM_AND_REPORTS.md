# Local SOC advice and employee reports

## Boundaries

- Employee **Scan URL** and **Report a link** use the same VirusTotal v3 + urlscan reputation lookup. They do not call the proxy ML model or the local LLM. Missing records, disabled keys and provider failures remain **Unknown**. Scanning alone creates no report, reward or proxy policy.
- **Scan file** accepts PDF and other non-empty file formats up to 10 MB for private employee VirusTotal checks. It creates no SOC/GRC report or live alert, changes no score and never writes a domain policy. Existing URL-report rewards are unchanged.
- Local LLM advice is requested explicitly by SOC in **Traffic & policies**. It is not in the proxy request path and cannot write a Block/Allow policy. The existing domain ML and SOC enforcement are unchanged.
- A hostname-only label cannot establish a site's actual content or guarantee safety. No TLS decryption, web crawling, tools or cloud fallback are used by the local model.

## Private file scanning and privacy

1. Employee selects a non-confidential file and explicitly agrees to share it with VirusTotal/security partners. PDFs, documents, images, archives and other formats are accepted; empty files are rejected. Acceptance does not guarantee that VT can analyze an unsupported or encrypted format.
2. Next.js checks the session cookie, same-origin request and bounded multipart body. Flask validates employee identity/role and the actual byte count. Bytes remain opaque: AFFERENT never parses, decompresses, executes or previews them. This is **not** a sanitizer or endpoint antivirus.
3. The reusable worker checks the SHA-256 report first. A known hash reuses VT evidence without uploading the bytes. Only a not-found hash is uploaded, with consent, using a generic filename.
4. A durable analysis ID is polled after submission. Quota limits defer work; uncertain upload failures are not automatically uploaded again. Zero detections mean no known engine detections, not proof of safety.
5. Original bytes are removed from the active queue after upload, completion or expiry. Metadata and evidence remain in the employee's private scan history. Results refresh every three seconds while a job is pending; provider queues and quota may take longer.
6. A malicious result shows **Threat detected — VirusTotal flagged this file. Do not open or run it.** Suspicious results show a separate caution. No detections show **No known threats detected**, never a safety guarantee. Missing evidence, provider errors and expired jobs remain Unknown.

Defaults: `FILE_SCAN_MAX_MB=10` (hard maximum 10 MB), 64 MB total queued originals, `FILE_SCAN_RETENTION_SECONDS=3600`, 20 requests/hour per account/type. The old `PDF_REPORT_*` variables remain fallbacks, so an existing `.env` needs no edit. VT's shared minute budget defaults to four requests; set `VT_REQUESTS_PER_MINUTE` to the quota actually granted to your key. Increasing it does not buy quota. SQLite removal is logical deletion, not guaranteed forensic erasure of backups/WAL/storage; do not upload confidential files in this demo.

API: `POST /api/threat/file-scan` accepts multipart `file` and `consent=true`, returning `scan` + `duplicate` (202 for a new job, 200 for a cached owned scan). `GET` on the same path returns the authenticated employee's `scans` and `maxBytes`; other employee accounts cannot see these records and SOC/GRC cannot use this endpoint. The old `POST /api/reports/pdf` returns 410. Only link reports remain at `/api/reports` and in the SOC/GRC inbox.

Migration is idempotent: legacy PDF metadata and jobs are moved into `employee_file_scans` / `file_analysis_jobs`; legacy report metadata is preserved, but excluded from report lists. Duplicate queued bytes are cleared from the retired queue only after the new job is recorded in the same transaction. Existing queued scans continue without a second upload. New file scans never publish `report.created` / `report.updated` or create a SOC alert.

LAN testing: open the dashboard on the employee laptop using the server's IP or DNS name and sign in on that address. Upload requests stay relative to that dashboard origin; no employee-IP allowlist or CORS override is needed. The upload guard compares the browser's `Origin` with the incoming `Host` (including the port), not Next.js's internal container hostname. A TLS-terminating reverse proxy must preserve the public `Host` and overwrite `X-Forwarded-Proto` with `http` or `https`; do not forward arbitrary client values for that header. Missing, malformed or cross-origin uploads remain rejected.

Official API/privacy references: [VT file submission](https://docs.virustotal.com/reference/files-scan), [analysis status](https://docs.virustotal.com/reference/analysis), [data sharing](https://docs.virustotal.com/docs/how-it-works).

## Demo startup

The normal stack includes `review_worker` for private file analysis. Local LLM is an optional GPU-enabled Compose profile with **no published API port**:

```powershell
docker compose --profile llm up -d --build
docker compose exec -T local_llm ollama pull qwen3:4b-instruct-2507-q4_K_M
```

Baseline configuration:

```dotenv
LOCAL_LLM_ENABLED=true
LOCAL_LLM_URL=http://local_llm:11434
LOCAL_LLM_MODEL=qwen3:4b-instruct-2507-q4_K_M
LOCAL_LLM_OUTPUT_MODE=json
LOCAL_LLM_TIMEOUT_SECONDS=45
```

Model loading after inactivity can be much slower than a warm request. The job queue keeps this delay out of login, OTP, notifications and the proxy request path. SOC sees asynchronous completion, not an instant enforcement verdict.

## Reproducible fine-tuning experiment

**Verified status, 3 October 2026:** both bounded fine-tuning experiments completed, but **neither candidate is accepted for activation**. V2 has 69 false flags among 600 benign hostnames (11.50%), 0% malware recall and 30.67% gambling recall; it fails quality gates and has not been imported. V1 also failed quality (14.33% false flags); its native INT4 import additionally failed generation with `MLX not available`. Quantized candidate quality/latency have **not** been measured. The active model remains the unmodified 4B baseline in advisory-only JSON mode. See [evaluation and additional dataset audit](LOCAL_LLM_EVALUATION.md).

Candidate: `Qwen/Qwen3-0.6B`, pinned revision `c1899de289a04d12100db370d81485cdf75e47ca`. QLoRA NF4, rank 8, hostname input, one-letter output, then CPU merge. Ollama 0.35.1's native Safetensors importer rejects `q4_K_M` for this model; this differs from the prebuilt GGUF 4B baseline. Training dependencies are isolated in `ml/local_llm/Dockerfile`, not added to Flask.

Labels confirmed by Daf: category CSV `0=benign`, `1=gambling`, `2=adult`, `3=streaming`. **Label 3 is excluded**, not mapped to phishing. The existing benign/phishing/malware corpus is also used. Its ambiguous `other` label is excluded, not guessed to mean defacement. HTML, titles, screenshots and URL paths are not model inputs. Conflicting hostname labels become Unknown.

Current preparation uses **only repository `train.csv`** as labeled input. Repository `val.csv`/`test.csv` are read solely to reserve domain groups, never as training examples. Previously evaluated v1 validation/test domain groups are also excluded. Root-URL labels remain source claims, not independent verification; path-dependent labels are not projected onto entire domains. A hostname known only through path-specific examples becomes Unknown (insufficient hostname evidence), not malicious. Label 3 remains excluded.

Preparation splits by registered domain, preventing fine-tuning train/validation/test domain overlap; source hashes and exclusion counts are recorded. Native examples and `*.sft.jsonl` exports use the exact runtime prompt and one-letter target, without fabricated scores, DNS/TCP status, generated reasoning or Block/Allow decisions. New artifacts refuse overwrites and are Git-ignored under `ml/artifacts`. The test is frozen; it is not used to select hyperparameters.

The following records the bounded v2 experiment, not an instruction to overwrite it. Existing artifact directories are intentionally refused; preserve evidence and use a separately reviewed exclusion set/new ID for a future run. Stop the review worker temporarily while using the GPU; its file/advice jobs are durable. Always restart it after the experiment, including after failure:

```powershell
docker build -t afferent-llm-training:v1 -f ml/local_llm/Dockerfile ml/local_llm
docker compose stop review_worker
docker compose exec -T local_llm ollama stop qwen3:4b-instruct-2507-q4_K_M
docker run --rm --memory 1g -v C:/AFFERENT/Human_Firewall:/work -v C:/Users/dafag/Downloads/labeled_data_final.csv:/data/categories.csv:ro afferent-llm-training:v1 python ml/local_llm/prepare.py --category-csv /data/categories.csv --exclude-experiment /work/ml/artifacts/hostname_v1_data --output /work/ml/artifacts/hostname_v2_scope_data
docker run --gpus all --memory 5g --env HF_HUB_OFFLINE=1 -v C:/AFFERENT/Human_Firewall:/work -v afferent_llm_training_cache:/root/.cache/huggingface afferent-llm-training:v1 python ml/local_llm/train.py --dataset /work/ml/artifacts/hostname_v2_scope_data --output /work/ml/artifacts/hostname_v2 --revision c1899de289a04d12100db370d81485cdf75e47ca --steps 300 --minutes 15
docker compose start review_worker
```

The run has a 15-minute **training** budget (validation and export are additional); actual optimizer steps are recorded. Offline mode requires the pinned model already present in the training cache. A preflight guard rejects changed files, mismatched prompts/targets, duplicates, reserved-domain contamination and insufficient holdout support **before** downloading/loading model weights. It requires >=400 benign and >=30 examples per threat class in each holdout.

Inspect `evaluation.json` before import. V2 gates require improvement over the untrained validation baseline, macro-F1 >=0.60, phishing/**malware**/gambling/adult recall >=0.50 each, and benign false-flag rate **and Wilson 95% upper bound** <=1%. The same quality gate applies to the frozen holdout and runtime evaluation. V1 used a weaker point-estimate gate; its historical results have not been rewritten. These remain internal experiment gates, not a real-world accuracy guarantee; temporal data/real lab traffic are still needed for broader claims.

Run offline regression checks:

```powershell
docker run --rm --memory 2g -v C:/AFFERENT/Human_Firewall:/work afferent-llm-training:v1 python -m unittest discover -s ml/local_llm -p test_*.py -v
```

Import attempt for reproduction only, **not a working deployment recipe or promotion**:

```powershell
docker compose --profile llm up -d local_llm
docker compose exec -T local_llm ollama create afferent-hostname-06b:v1 --quantize int4 -f /training/Modelfile
```

The checked-in `ml/local_llm/Modelfile` is mounted read-only; `FROM /models/hostname_v1/merged` matches Compose's read-only artifact mount. The above import produces a 646 MB model, but the installed runtime cannot generate from it. Do not switch the application to this candidate. A different export/runtime would need separate verification, and cannot fix its already-failed quality gate.

`runtime_check.py` is a separate verification tool for a future runnable candidate, using the exact frozen dataset/candidate paths. It records cold loading, warm p50/p95 and post-quantization holdout metrics. The warm p95 experiment gate is 250 ms on Daf's GPU; this is not a guarantee on a different server and excludes queue/UI refresh. No runtime evaluation file was produced for v1 because its first generation failed.

Only after successful quality/runtime checks, set `LOCAL_LLM_MODEL=afferent-hostname-06b:v1` and `LOCAL_LLM_OUTPUT_MODE=class_token`, then recreate Flask/review worker. This remains **advisory-only**, with no invented confidence percentage. A failed candidate must not silently replace the baseline.

## Manual checks

- Employee: Scan URL uses VT/urlscan evidence; Report a link still appears in SOC and retains existing reward rules.
- Employee: Scan file with a harmless non-confidential PDF and a `.txt`/image file after consenting; verify automatic results in File scans and View result after reopening the dashboard.
- A second employee sees only their own scan history. SOC/GRC Security inbox and live alerts must not receive these scans, including malicious results; link reports still appear normally.
- A mocked malicious VT result in the isolated tests produces the threat banner; no live malware or confidential file is uploaded by automated tests. Unknown/rate-limited results must never be shown as safe.
- SOC: request Local second opinion on a traffic item. Advice does not change policy; an explicit Block/Allow still requires the normal confirmation/audit flow.
- OTP, phishing campaigns and proxy on/off detection must remain unchanged. No mobile visual testing is required.
