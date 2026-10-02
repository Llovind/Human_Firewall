# AFFERENT v5 -- feature_extractor.py
# Auto-generated from the training notebook to guarantee training/serving parity.
import re, math
from collections import Counter
from urllib.parse import urlparse
import tldextract

BRANDS = ['paypal', 'facebook', 'google', 'apple', 'amazon', 'microsoft', 'netflix', 'instagram', 'twitter', 'linkedin', 'dropbox', 'whatsapp', 'outlook', 'office365', 'icloud', 'ebay', 'adobe', 'klikbca', 'mandiri', 'bri', 'bni', 'permata', 'cimb', 'btn', 'danamon', 'tokopedia', 'shopee', 'gojek', 'grab', 'traveloka', 'dana', 'ovo', 'gopay', 'linkaja', 'bpjs', 'pajak', 'dukcapil']
HIGH_RISK_TLDS = {'.link', '.sbs', '.cfd', '.site', '.pw', '.live', '.bond', '.cc', '.cf', '.tk', '.vip', '.lol', '.info', '.lat', '.ml', '.top', '.loan', '.beauty', '.win', '.mom', '.icu', '.quest', '.work', '.monster', '.rest', '.click', '.gq', '.online', '.club', '.xyz', '.ga', '.buzz', '.cyou', '.fun'}
SUSPICIOUS_KW = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'banking', 'wallet', 'password', 'credential', 'webscr', 'cmd=_', 'click', 'redirect', 'suspend', 'limited', 'unlock', 'validate', 'daftar', 'masuk', 'konfirmasi', 'verifikasi', 'keamanan', 'blokir']
JUDOL_KW = ['slot', 'gacor', 'maxwin', 'rtp', 'jackpot', 'togel', 'toto', 'judi', 'taruhan', 'pragmatic', 'olympus', 'zeus', 'mahjong', 'scatter', 'spaceman', 'sbobet', 'rungkad', 'freebet', 'bonanza', 'starlight', 'gatotkaca', 'wildbandito']
SHORTENERS = {'rebrand.ly', 's.id', 'bit.ly', 'ow.ly', 'buff.ly', 'goo.gl', 'tinyurl.com', 'tiny.cc', 't.co', 'is.gd', 'shorte.st', 'bit.do', 'cutt.ly', 'adf.ly'}


def levenshtein(s1, s2):
    if len(s1) < len(s2):
        s1, s2 = s2, s1
    prev = list(range(len(s2) + 1))
    for c1 in s1:
        curr = [prev[0] + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[-1] + 1, prev[j] + (c1 != c2)))
        prev = curr
    return prev[-1]


def brand_min_distance(domain: str, brands=BRANDS) -> int:
    domain = domain.lower()
    best = 99
    for b in brands:
        if b in domain:
            return 0
        for i in range(max(1, len(domain) - len(b) + 1)):
            d = levenshtein(domain[i:i + len(b)], b)
            if d < best:
                best = d
        best = min(best, levenshtein(domain, b))
    return best


def brand_domain_mismatch(url_lower: str, domain: str, brands=BRANDS) -> int:
    domain = domain.lower()
    for b in brands:
        if b in url_lower and b not in domain:
            return 1
    return 0


def shannon_entropy(s):
    if not s:
        return 0.0
    cnt = Counter(s)
    n = len(s)
    return -sum((v / n) * math.log2(v / n) for v in cnt.values())


def max_consecutive_consonants(s):
    vowels = set("aeiou")
    best = cur = 0
    for c in s.lower():
        if c.isalpha() and c not in vowels:
            cur += 1
            best = max(best, cur)
        elif c.isalpha():
            cur = 0
    return best


def extract_features(url: str) -> dict:
    url = str(url)
    try:
        parsed = urlparse(url if url.startswith("http") else "http://" + url)
    except Exception:
        parsed = urlparse("http://unknown")
    ext = tldextract.extract(url)
    domain = ext.domain or ""
    subdomain = ext.subdomain or ""
    suffix = ext.suffix or ""
    registered_domain = f"{domain}.{suffix}".strip(".")
    path = parsed.path or ""
    query = parsed.query or ""
    host = parsed.netloc.split(":")[0]
    path_parts = [p for p in path.split("/") if p]
    is_ip = bool(re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host))
    lev_min = brand_min_distance(domain)
    url_lower = url.lower()
    judol_hits = sum(1 for kw in JUDOL_KW if kw in url_lower)

    return {
        "url_len": len(url),
        "domain_len": len(host),
        "path_len": len(path),
        "query_len": len(query),
        "path_depth": len(path_parts),
        "query_param_cnt": len(query.split("&")) if query else 0,
        "num_digits": sum(c.isdigit() for c in url),
        "num_dashes": url.count("-"),
        "num_dots": url.count("."),
        "num_slashes": url.count("/"),
        "num_special": sum(c in "@?=&%+#" for c in url),
        "num_upper": sum(c.isupper() for c in url),
        "subdomain_count": len([s for s in subdomain.split(".") if s]),
        "has_at": int("@" in url),
        "has_port": int(":" in host),
        "uses_https": int(parsed.scheme == "https"),
        "is_ip": int(is_ip),
        "tld_risk": float(f".{suffix}".lower() in HIGH_RISK_TLDS),
        "levenshtein_min": lev_min,
        "keyword_count": sum(1 for kw in SUSPICIOUS_KW if kw in url_lower),
        "entropy_domain": shannon_entropy(domain),
        "entropy_url": shannon_entropy(url),
        "has_brand_name": int(any(b in url_lower for b in BRANDS)),
        "brand_mismatch": brand_domain_mismatch(url_lower, domain),
        "ratio_digits": sum(c.isdigit() for c in url) / max(len(url), 1),
        "ratio_dashes": url.count("-") / max(len(host), 1),
        "typosquat_subs": len(re.findall(r"[0-9](?=[a-z])|[a-z](?=[0-9])", domain)),
        "has_punycode": int("xn--" in host.lower()),
        "is_shortener": int(registered_domain.lower() in SHORTENERS),
        "judol_score": judol_hits,
        "has_judol_kw": int(judol_hits > 0),
        "max_consonant_run": max_consecutive_consonants(domain),
        "vowel_ratio_domain": sum(c in "aeiou" for c in domain.lower()) / max(len(domain), 1),
        "www_prefix": int(subdomain.lower() == "www"),
        "num_www_like": int(bool(re.search(r"w{2,}\d?\.", host.lower()))),
        "ip_in_query": int(bool(re.search(r"\d{1,3}(?:\.\d{1,3}){3}", query))),
    }


def apply_realtime_overrides(base_prediction, live_features):
    # STUB for the serving team -- NOT implemented or trained here.
    # live_features is computed live by the backend (domain_age_days, ssl_valid,
    # ssl_trust_score, redirect_count, asn_reputation, ...) -- point-in-time facts
    # that cannot be reconstructed retroactively from a static training set.
    #   domain_age = live_features.get('domain_age_days', 999)
    #   lev_min = base_prediction.get('levenshtein_min', 99)
    #   if domain_age < 3 and lev_min <= 2:
    #       base_prediction['label'] = 'phishing'
    #       base_prediction['confidence'] = max(base_prediction['confidence'], 0.70)
    return base_prediction
