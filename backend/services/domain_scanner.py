"""Calibrated, hostname-only ML. Never fetch URLs or inspect TLS payloads."""
import hashlib
import json
import logging
import math
import os
import re
import threading
from pathlib import Path

_lock = threading.Lock()
_attempted = False
_model = None
_manifest = {}
logger = logging.getLogger(__name__)
POLICY_REVISION = 'generated-host-review-v1'


def model_version():
    warmup()
    version = _manifest.get('model_version')
    return f'{version}:{POLICY_REVISION}' if version else None


def generated_hostname(domain):
    # ponytail: lexical abstention, replace with an OOD gate after a labelled
    # infrastructure/hashed-host benchmark exists; this also defers real DGA.
    # UUID/hex service hostnames are outside this URL-labelled corpus's useful
    # scope. Abstain, NOT whitelist: SOC blocks still take precedence.
    return any(re.search(r'[0-9a-f]{24,}', label) for label in domain.split('.')[:-2])


def warmup():
    global _attempted, _model, _manifest
    with _lock:
        if _attempted:
            return
        _attempted = True
        directory = Path(os.environ.get("ML_DOMAIN_MODEL_DIR", str(Path(__file__).resolve().parent.parent / "models/domain_v3")))
        try:
            import joblib
            manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
            artifact = directory / "classifier.joblib"
            # Only trusted local training artifacts may be unpickled.
            if manifest.get("feature_scope") != "domain" or hashlib.sha256(artifact.read_bytes()).hexdigest() != manifest.get("artifact_sha256"):
                raise ValueError("Domain artifact scope/checksum mismatch")
            threshold = manifest.get("block_threshold")
            if threshold is not None and (not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or not 0 <= threshold <= 1):
                raise ValueError("Invalid domain threshold")
            _model = joblib.load(artifact)
            _manifest = manifest
        except Exception as exc:
            logger.error("Domain ML unavailable: %s", type(exc).__name__)


def status():
    warmup()
    return {"available": _model is not None, "inputScope": "domain",
        "modelVersion": model_version(),
        "policyRevision": POLICY_REVISION,
        "evaluationScope": "artifact operating point; runtime guard evaluation recorded separately",
        "enforcementEligible": bool(_manifest.get("enforcement_eligible")),
        "blockThreshold": _manifest.get("block_threshold"),
        "evaluation": _manifest.get("test_unique_domain_labels", {})}


def scan(domain):
    warmup()
    if _model is None:
        return {"verdict": "unknown", "confidence": None, "status": "unavailable",
            "reason": "Domain ML tidak tersedia; akses ditahan untuk retry", "modelVersion": None}
    from services.proxy_service import normalize_domain
    domain = normalize_domain(domain)
    if generated_hostname(domain):
        return {'verdict': 'unknown', 'confidence': None, 'status': 'ready',
            'reason': 'Hostname layanan ber-ID/hash: di luar cakupan kalibrasi. Unknown, bukan bukti malicious atau whitelist; SOC tetap dapat memblokir.',
            'modelVersion': model_version()}
    margin = _model["pipeline"].decision_function([domain]).reshape(-1, 1)
    probability = float(_model["calibrator"].predict_proba(margin)[0, 1])
    if not math.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError("Non-finite domain prediction")
    threshold = _manifest.get("block_threshold")
    if _manifest.get("enforcement_eligible") and threshold is not None and probability >= threshold:
        verdict, confidence = "malicious", probability
    elif probability <= 0.1:
        verdict, confidence = "safe", 1 - probability
    else:
        verdict, confidence = "unknown", None
    return {"verdict": verdict, "confidence": confidence, "status": "ready",
        "reason": f"Domain-only TF-IDF/Logistic Regression; P_mal={probability:.4f}; verdict={verdict}; tanpa TLS inspection",
        "modelVersion": model_version()}
