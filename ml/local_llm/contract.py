"""Identical training/runtime prompt. Two output tokens, no chain of thought."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from services.hostname_llm_contract import LABELS, SYSTEM, messages
