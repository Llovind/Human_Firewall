"""
Char-BiLSTM URL Threat Scanner (Afferent v5)
Character-level CNN-BiLSTM with Attention Pooling for zero-day phishing,
malware, and Indonesian online gambling (judol) detection.
"""

import os
import json
import logging
import hashlib
import threading
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Fallback state if torch/sklearn not installed or weights not found
_MODEL = None
_CONFIG = None
_CALIBRATORS = None
_INIT_ATTEMPTED = False
_INIT_LOCK = threading.Lock()
_MODEL_VERSION = None


def _find_artifact(filename: str, subpath: str = "") -> Optional[Path]:
    """Find artifact in backend/models, result v5, or environment override."""
    candidates = []
    
    # 1. Environment variable overrides
    env_key = f"CHAR_BILSTM_{filename.upper().replace('.', '_')}"
    if env_key in os.environ:
        candidates.append(Path(os.environ[env_key]))

    current_dir = Path(__file__).resolve().parent
    workspace_dir = current_dir.parent

    # 2. Local backend/models directory
    candidates.append(current_dir / "models" / filename)
    
    # 3. result v5 directory in workspace
    if subpath:
        candidates.append(workspace_dir / "result v5" / subpath / filename)
    candidates.append(workspace_dir / "result v5" / filename)

    for p in candidates:
        if p.exists() and p.is_file():
            return p
    return None


def _init_components():
    # Flask can receive concurrent cold-start requests. Publish a ready model
    # only once; another request must not mistake partial initialization for failure.
    with _INIT_LOCK:
        if not _INIT_ATTEMPTED:
            _load_components()


def _load_components():
    global _MODEL, _CONFIG, _CALIBRATORS, _INIT_ATTEMPTED, _MODEL_VERSION
    if _INIT_ATTEMPTED:
        return
    _INIT_ATTEMPTED = True

    try:
        import torch
        import torch.nn as nn
    except ImportError as e:
        logger.warning(f"[Char-BiLSTM] PyTorch not installed ({e}); DL scanner will be disabled.")
        return

    config_path = _find_artifact("production_config.json", subpath="afferent_models")
    model_path = _find_artifact("char_bilstm.pt")
    calibrators_path = _find_artifact("calibrators.pkl", subpath="afferent_models")

    if not config_path or not model_path:
        logger.warning(f"[Char-BiLSTM] Artifacts missing (config: {config_path}, model: {model_path})")
        return

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            _CONFIG = json.load(f)

        torch.set_num_threads(max(1, int(os.environ.get("ML_CPU_THREADS", "2"))))
        labels = _CONFIG["label_order"]
        thresholds = _CONFIG["action_thresholds"]
        if "benign" not in labels or not 0 <= thresholds["block_review"] < thresholds["block_auto"] <= 1:
            raise ValueError("Invalid label order or calibrated action thresholds")
        if not _CONFIG.get("char2idx") or max(_CONFIG["char2idx"].values()) >= _CONFIG["vocab_size"]:
            raise ValueError("Invalid training vocabulary")

        vocab_size = _CONFIG.get("vocab_size", 87)
        n_cls = len(_CONFIG.get("label_order", ["benign", "phishing", "malware", "other"]))

        class CharEncoderBiLSTM(nn.Module):
            def __init__(self, vocab=vocab_size, emb=64, filters=128, kernels=(3, 5, 7),
                         lstm_h=128, lstm_l=2, drop=0.3):
                super().__init__()
                self.embed = nn.Embedding(vocab, emb, padding_idx=0)
                self.convs = nn.ModuleList([
                    nn.Sequential(
                        nn.Conv1d(emb, filters, k, padding=k // 2),
                        nn.GELU(),
                        nn.Dropout(drop / 2)
                    )
                    for k in kernels
                ])
                cnn_dim = filters * len(kernels)
                self.bilstm = nn.LSTM(
                    cnn_dim, lstm_h, lstm_l,
                    bidirectional=True, batch_first=True,
                    dropout=drop if lstm_l > 1 else 0.0
                )
                self.attn = nn.Linear(lstm_h * 2, 1)
                self.out_dim = lstm_h * 2

            def forward(self, x):
                e = self.embed(x)
                ci = e.permute(0, 2, 1)
                c = torch.cat([cv(ci).permute(0, 2, 1) for cv in self.convs], -1)
                out, _ = self.bilstm(c)
                w = torch.softmax(self.attn(out), 1)
                return (out * w).sum(1)

        class CharClassifier(nn.Module):
            def __init__(self, encoder, n_cls=n_cls, drop=0.3):
                super().__init__()
                self.encoder = encoder
                self.head = nn.Sequential(
                    nn.Linear(encoder.out_dim, 128),
                    nn.GELU(),
                    nn.Dropout(drop),
                    nn.Linear(128, n_cls)
                )

            def forward(self, x):
                return self.head(self.encoder(x))

        encoder = CharEncoderBiLSTM(vocab=vocab_size)
        model = CharClassifier(encoder=encoder, n_cls=n_cls)

        weights = torch.load(str(model_path), map_location="cpu", weights_only=True)
        model.load_state_dict(weights)
        model.eval()
        _MODEL = model
        digest = hashlib.sha256(model_path.read_bytes() + config_path.read_bytes())
        if calibrators_path:
            digest.update(calibrators_path.read_bytes())
        _MODEL_VERSION = f"char-bilstm-v5-{digest.hexdigest()[:12]}"
        logger.info(f"[Char-BiLSTM] Successfully loaded weights from {model_path}")

    except Exception as e:
        logger.error(f"[Char-BiLSTM] Failed to load model: {e}", exc_info=True)
        _MODEL = None

    if calibrators_path:
        try:
            import pickle
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                with open(calibrators_path, "rb") as f:
                    _CALIBRATORS = pickle.load(f)
            logger.info(f"[Char-BiLSTM] Loaded isotonic calibrators from {calibrators_path}")
        except Exception as e:
            logger.warning(f"[Char-BiLSTM] Calibrators load error ({e}); using uncalibrated softmax.")
            _CALIBRATORS = None


def is_scanner_available() -> bool:
    """Check if the Char-BiLSTM model is loaded and ready for inference."""
    _init_components()
    return _MODEL is not None and _CONFIG is not None


def model_status() -> dict:
    available = is_scanner_available()
    return {"available": available, "calibrated": _CALIBRATORS is not None,
            "modelVersion": _MODEL_VERSION,
            "thresholds": (_CONFIG or {}).get("action_thresholds", {})}


def scan_url_dl(url: str) -> Optional[Dict[str, Any]]:
    """
    Scan a URL using the Char-BiLSTM Deep Learning model.
    
    Returns structured analysis containing:
    - verdict: 'malicious', 'suspicious', or 'clean'
    - action: 'BLOCK', 'REVIEW', or 'ALLOW'
    - threat_type: 'phishing', 'malware', 'other', or 'benign'
    - confidence: int (0..100)
    - p_malicious: float (0.0..1.0)
    - probabilities: dict with per-class calibrated probabilities
    """
    if not is_scanner_available():
        return None

    try:
        import torch
        import numpy as np

        char2idx = _CONFIG.get("char2idx", {})
        max_len = _CONFIG.get("max_url_len", 200)
        label_order = _CONFIG.get("label_order", ["benign", "phishing", "malware", "other"])
        action_thresholds = _CONFIG.get("action_thresholds", {
            "block_auto": 0.95,
            "block_review": 0.70,
            "allow_log": 0.0
        })

        # Tokenization & zero-padding
        raw_url = str(url or "").strip()
        ids = [char2idx.get(c, 1) for c in raw_url[:max_len]]
        ids += [0] * (max_len - len(ids))

        inp_tensor = torch.tensor([ids], dtype=torch.long)
        with torch.inference_mode():
            logits = _MODEL(inp_tensor)
            probs = torch.softmax(logits, dim=-1).cpu().numpy()

        # Calibration step
        if _CALIBRATORS is not None and len(_CALIBRATORS) == len(label_order):
            try:
                p_cal = np.column_stack([cal.predict(probs[:, c]) for c, cal in enumerate(_CALIBRATORS)])
                if not np.isfinite(p_cal).all() or p_cal.sum() <= 0:
                    raise ValueError("Invalid calibrated probabilities")
                p_cal = p_cal / p_cal.sum(axis=1, keepdims=True).clip(min=1e-9)
                final_probs = p_cal[0]
                calibrated = True
            except Exception as cal_err:
                logger.debug(f"[Char-BiLSTM] Calibration fallback: {cal_err}")
                final_probs = probs[0]
                calibrated = False
        else:
            final_probs = probs[0]
            calibrated = False

        if not np.isfinite(final_probs).all():
            raise ValueError("Invalid inference probabilities")

        benign_idx = label_order.index("benign") if "benign" in label_order else 0
        p_malicious = float(1.0 - final_probs[benign_idx])

        # Predicted threat category
        pred_idx = int(np.argmax(final_probs))
        threat_type = label_order[pred_idx]

        # Action based on production action thresholds
        thr_block = float(action_thresholds.get("block_auto", 0.95))
        thr_review = float(action_thresholds.get("block_review", 0.70))

        if p_malicious >= thr_block:
            action = "BLOCK"
            verdict = "malicious"
            severity = "high"
        elif p_malicious >= thr_review:
            action = "REVIEW"
            verdict = "suspicious"
            severity = "medium"
        else:
            action = "ALLOW"
            verdict = "clean"
            severity = "low"

        # Thresholds were fitted on calibrated probabilities. Do not silently
        # enforce an uncalibrated prediction when the calibration artifact fails.
        if not calibrated:
            action, verdict, severity = "REVIEW", "suspicious", "medium"

        # Special nuance for "other" class (Indonesian threat pattern: judol / scam)
        threat_display = threat_type
        if threat_type == "other" and verdict in ("malicious", "suspicious"):
            threat_display = "judol_scam"

        prob_dict = {label_order[i]: round(float(final_probs[i]), 4) for i in range(len(label_order))}

        # Integer confidence (0..100) aligned with backend policy engine
        confidence = int(round(p_malicious * 100)) if verdict != "clean" else int(round(final_probs[benign_idx] * 100))

        return {
            "provider": "char_bilstm",
            "model_name": "Char-BiLSTM (Afferent v5 Production)",
            "model_version": _MODEL_VERSION,
            "url": raw_url,
            "verdict": verdict,
            "severity": severity,
            "action": action,
            "threat_type": threat_display,
            "confidence": confidence,
            "p_malicious": round(p_malicious, 4),
            "probabilities": prob_dict,
            "calibrated": calibrated,
            "thresholds": {
                "block_auto": thr_block,
                "block_review": thr_review
            }
        }

    except Exception as e:
        logger.error("[Char-BiLSTM] Inference failed: %s", type(e).__name__, exc_info=True)
        return None
