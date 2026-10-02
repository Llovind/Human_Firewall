"""
Domain Reputation Module — Human Firewall (Afferent v5)
=======================================================
Provides a layered domain trust system to prevent false positives from the
Char-BiLSTM model on well-known, legitimate domains.

Layers (checked in order):
  1. TRUSTED_DOMAINS  — exact apex domain match (e.g. "microsoft.com")
  2. TRUSTED_TLDS     — institutional TLDs (.gov, .go.id, .ac.id, .edu, .mil)
  3. Suspicious TLDs  — high-risk TLDs commonly abused by phishing actors

Usage:
    from domain_reputation import check_domain_reputation
    rep = check_domain_reputation("https://support.microsoft.com/...")
    # rep["trusted"] → True
    # rep["trust_level"] → "global_brand"
    # rep["reason"] → "Apex domain 'microsoft.com' is in trusted whitelist"
"""

from __future__ import annotations

import re
from urllib.parse import urlparse
from typing import Optional

# ---------------------------------------------------------------------------
# Tier 1 – Global Trusted Apex Domains (Fortune 500 / FAANG / Gov portals)
# These are matched against the *apex domain* (eTLD+1), not subdomain.
# ---------------------------------------------------------------------------
TRUSTED_DOMAINS: dict[str, str] = {
    # Microsoft ecosystem
    "microsoft.com": "global_brand",
    "microsoftonline.com": "global_brand",
    "azure.com": "global_brand",
    "live.com": "global_brand",
    "outlook.com": "global_brand",
    "bing.com": "global_brand",
    "office.com": "global_brand",
    "sharepoint.com": "global_brand",
    "windows.com": "global_brand",

    # Google ecosystem
    "google.com": "global_brand",
    "google.co.id": "global_brand",
    "googleapis.com": "global_brand",
    "googleusercontent.com": "global_brand",
    "gstatic.com": "global_brand",
    "gmail.com": "global_brand",
    "youtube.com": "global_brand",
    "youtu.be": "global_brand",
    "chromium.org": "global_brand",
    "android.com": "global_brand",

    # Apple
    "apple.com": "global_brand",
    "icloud.com": "global_brand",

    # Meta / Facebook
    "facebook.com": "global_brand",
    "fb.com": "global_brand",
    "instagram.com": "global_brand",
    "whatsapp.com": "global_brand",
    "messenger.com": "global_brand",

    # Amazon / AWS
    "amazon.com": "global_brand",
    "aws.amazon.com": "global_brand",
    "amazonaws.com": "global_brand",
    "amazon.co.id": "global_brand",
    "tokopedia.com": "local_brand",

    # Developer / Tech hubs
    "github.com": "global_brand",
    "github.io": "global_brand",
    "stackoverflow.com": "global_brand",
    "npmjs.com": "global_brand",
    "pypi.org": "global_brand",
    "docker.com": "global_brand",
    "kubernetes.io": "global_brand",
    "nginx.com": "global_brand",

    # Security / Threat Intel vendors
    "virustotal.com": "global_brand",
    "shodan.io": "global_brand",
    "abuse.ch": "global_brand",
    "urlscan.io": "global_brand",

    # News / Wikipedia
    "wikipedia.org": "global_brand",
    "wikimedia.org": "global_brand",
    "bbc.com": "global_brand",
    "reuters.com": "global_brand",
    "cnn.com": "global_brand",

    # Indonesian Government (OFFICIAL)
    "kominfo.go.id": "id_government",
    "kemenkeu.go.id": "id_government",
    "pajak.go.id": "id_government",
    "bpjs-kesehatan.go.id": "id_government",
    "bpjsketenagakerjaan.go.id": "id_government",
    "kpu.go.id": "id_government",
    "bi.go.id": "id_government",
    "ojk.go.id": "id_government",
    "kemendikbud.go.id": "id_government",
    "bnpb.go.id": "id_government",
    "indonesia.go.id": "id_government",
    "setneg.go.id": "id_government",
    "covid19.go.id": "id_government",

    # Indonesian State-Owned Enterprises (BUMN)
    "bca.co.id": "id_enterprise",
    "bni.co.id": "id_enterprise",
    "bri.co.id": "id_enterprise",
    "mandiri.co.id": "id_enterprise",
    "btn.co.id": "id_enterprise",
    "pertamina.com": "id_enterprise",
    "pln.co.id": "id_enterprise",
    "telkom.co.id": "id_enterprise",
    "telkomsel.com": "id_enterprise",
    "indosat.com": "id_enterprise",
    "garuda-indonesia.com": "id_enterprise",
    "kai.id": "id_enterprise",
    "angkasapura.co.id": "id_enterprise",

    # Indonesian Universities (Akreditasi A)
    "telkomuniversity.ac.id": "id_education",
    "ui.ac.id": "id_education",
    "itb.ac.id": "id_education",
    "ugm.ac.id": "id_education",
    "its.ac.id": "id_education",
    "unpad.ac.id": "id_education",
    "undip.ac.id": "id_education",
    "unair.ac.id": "id_education",
    "ipb.ac.id": "id_education",
    "upi.edu": "id_education",
    "uns.ac.id": "id_education",
    "unibraw.ac.id": "id_education",

    # E-commerce Indonesia
    "shopee.co.id": "local_brand",
    "lazada.co.id": "local_brand",
    "bukalapak.com": "local_brand",
    "blibli.com": "local_brand",
    "tokopedia.com": "local_brand",
    "gojek.com": "local_brand",
    "grab.com": "local_brand",
    "traveloka.com": "local_brand",
    "tiket.com": "local_brand",
}

# ---------------------------------------------------------------------------
# Tier 2 – Trusted Institutional TLD Patterns
# If apex domain isn't in Tier 1 but TLD matches, treat as semi-trusted.
# ---------------------------------------------------------------------------
TRUSTED_TLD_PATTERNS: list[tuple[str, str]] = [
    (r"\.go\.id$",    "id_government"),   # Indonesian central/regional govt
    (r"\.mil\.id$",   "id_military"),     # Indonesian military
    (r"\.ac\.id$",    "id_education"),    # Indonesian universities
    (r"\.sch\.id$",   "id_education"),    # Indonesian schools
    (r"\.or\.id$",    "id_ngo"),          # Indonesian non-profit orgs
    (r"\.gov$",       "us_government"),   # US / generic government
    (r"\.gov\.au$",   "au_government"),   # Australian government
    (r"\.gov\.uk$",   "uk_government"),   # UK government
    (r"\.edu$",       "us_education"),    # US universities
    (r"\.mil$",       "us_military"),     # US military
    (r"\.int$",       "international"),   # International orgs (UN, NATO, etc.)
]

# ---------------------------------------------------------------------------
# Suspicious TLD list — high-risk, boosts DL model weight if matched
# ---------------------------------------------------------------------------
SUSPICIOUS_TLDS: set[str] = {
    ".xyz", ".tk", ".ml", ".ga", ".cf", ".gq",   # Free / abused TLDs
    ".top", ".click", ".date", ".download",
    ".review", ".stream", ".accountant",
    ".loan", ".men", ".party", ".win",
    ".trade", ".webcam", ".racing", ".cricket",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _extract_apex(hostname: str) -> str:
    """
    Extract the eTLD+1 (apex domain) from a hostname.
    Handles common two-part ccTLDs like .co.id, .go.id, .ac.id, .or.id, etc.

    Examples:
      support.microsoft.com  → microsoft.com
      mail.google.co.id      → google.co.id
      sso.bca.co.id          → bca.co.id
      en.wikipedia.org       → wikipedia.org
    """
    hostname = hostname.lower().rstrip(".")
    parts = hostname.split(".")

    if len(parts) <= 2:
        return hostname

    # Known compound second-level domains under .id
    ID_SLD = {"co", "go", "ac", "sch", "or", "mil", "net", "web"}
    if parts[-1] == "id" and len(parts) >= 3 and parts[-2] in ID_SLD:
        # e.g. bca.co.id → [-3]="bca", [-2]="co", [-1]="id"
        return ".".join(parts[-3:]) if len(parts) >= 3 else hostname

    # Default: take last 2 parts (handles .com, .org, .net, .io, etc.)
    return ".".join(parts[-2:])


def _get_tld(hostname: str) -> str:
    """Return the TLD (last component after the last dot)."""
    return "." + hostname.lower().rstrip(".").rsplit(".", 1)[-1]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_domain_reputation(url: str) -> dict:
    """
    Check the domain reputation of a URL.

    Returns a dict:
    {
        "trusted":      bool,        # True if the domain is considered trustworthy
        "suspicious":   bool,        # True if TLD is high-risk
        "trust_level":  str | None,  # e.g. "global_brand", "id_government", None
        "apex_domain":  str | None,  # e.g. "microsoft.com"
        "hostname":     str | None,
        "reason":       str,         # Human-readable explanation
        "dl_weight":    float,       # Suggested weight multiplier for DL score (0.0–1.0)
        "vt_required":  bool,        # Whether VT cross-check is strongly recommended
    }
    """
    result = {
        "trusted":     False,
        "suspicious":  False,
        "trust_level": None,
        "apex_domain": None,
        "hostname":    None,
        "reason":      "No reputation data available.",
        "dl_weight":   1.0,    # Full DL trust by default
        "vt_required": False,
    }

    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        hostname = parsed.hostname
    except Exception:
        result["reason"] = "Failed to parse URL."
        return result

    if not hostname:
        result["reason"] = "Could not extract hostname from URL."
        return result

    result["hostname"] = hostname
    apex = _extract_apex(hostname)
    result["apex_domain"] = apex

    # ------------------------------------------------------------------
    # Tier 1: Exact apex domain match in TRUSTED_DOMAINS
    # ------------------------------------------------------------------
    if apex in TRUSTED_DOMAINS:
        trust_level = TRUSTED_DOMAINS[apex]
        result.update({
            "trusted":     True,
            "trust_level": trust_level,
            "reason":      f"Apex domain '{apex}' is in the trusted domain whitelist ({trust_level}).",
            "dl_weight":   0.0,    # DL verdict is suppressed for known-good domains
            "vt_required": False,  # VT is nice-to-have, not required for top-tier
        })
        return result

    # ------------------------------------------------------------------
    # Tier 2: Institutional TLD pattern match
    # ------------------------------------------------------------------
    for pattern, trust_level in TRUSTED_TLD_PATTERNS:
        if re.search(pattern, hostname):
            result.update({
                "trusted":     True,
                "trust_level": trust_level,
                "reason":      f"Hostname '{hostname}' matches trusted institutional TLD pattern ({trust_level}).",
                "dl_weight":   0.3,   # DL still checked but weight reduced heavily
                "vt_required": True,  # Cross-check with VT recommended for unlisted domains
            })
            return result

    # ------------------------------------------------------------------
    # Tier 3: Suspicious TLD check
    # ------------------------------------------------------------------
    tld = _get_tld(hostname)
    if tld in SUSPICIOUS_TLDS:
        result.update({
            "trusted":    False,
            "suspicious": True,
            "reason":     f"TLD '{tld}' is in the high-risk TLD list.",
            "dl_weight":  1.3,    # Amplify DL score for risky TLDs (capped at 1.0 in consumer)
            "vt_required": True,
        })
        return result

    # ------------------------------------------------------------------
    # Default: Unknown domain — trust DL model at full weight
    # ------------------------------------------------------------------
    result["reason"] = f"Domain '{apex}' has no reputation data; using DL model at full weight."
    result["vt_required"] = True
    return result


def is_trusted(url: str) -> bool:
    """Quick helper — returns True if domain is in Tier 1 or Tier 2 trusted list."""
    return check_domain_reputation(url)["trusted"]
