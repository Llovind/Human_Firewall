import requests
import os
import urllib3

# Disable InsecureRequestWarning for self-signed GoPhish certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

GOPHISH_API_KEY = os.environ.get('GOPHISH_API_KEY', '')
GOPHISH_API_URL = os.environ.get('GOPHISH_API_URL', 'https://gophish:3333')

def _request(method, endpoint, payload=None):
    url = f"{GOPHISH_API_URL.rstrip('/')}{endpoint}"
    
    # Try api_key in query string first as universally supported by GoPhish
    if '?' in url:
        url = f"{url}&api_key={GOPHISH_API_KEY}"
    else:
        url = f"{url}?api_key={GOPHISH_API_KEY}"

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {GOPHISH_API_KEY}'
    }
    
    response = requests.request(
        method=method, 
        url=url, 
        json=payload, 
        headers=headers, 
        verify=False,
        timeout=5
    )
    
    response.raise_for_status()
    
    if response.text:
        return response.json()
    return {}

def _compute_campaign_stats(results):
    """GoPhish's list/get-campaign endpoints (`GET /api/campaigns/` dan
    `GET /api/campaigns/:id`) TIDAK menyertakan field `stats` — itu cuma
    ada di endpoint terpisah `GET /api/campaigns/:id/summary`. Daripada
    nembak 1 API call ekstra per campaign tiap kali polling (boros +
    lambat), kita hitung sendiri dari `results[].status` yang UDAH ada
    di response list. `status` per-target bersifat progresif (nilai
    tertinggi yang pernah dicapai target itu), jadi setiap tahap otomatis
    mencakup semua tahap sebelumnya — makanya masing-masing hitungan
    dicek dengan `in` terhadap set status match-or-above."""
    sent_statuses = {'Email Sent', 'Email Opened', 'Clicked Link', 'Submitted Data', 'Email Reported'}
    opened_statuses = {'Email Opened', 'Clicked Link', 'Submitted Data', 'Email Reported'}
    clicked_statuses = {'Clicked Link', 'Submitted Data', 'Email Reported'}
    submitted_statuses = {'Submitted Data', 'Email Reported'}

    total = len(results or [])
    sent = sum(1 for r in results or [] if r.get('status') in sent_statuses)
    opened = sum(1 for r in results or [] if r.get('status') in opened_statuses)
    clicked = sum(1 for r in results or [] if r.get('status') in clicked_statuses)
    submitted_data = sum(1 for r in results or [] if r.get('status') in submitted_statuses)
    error = sum(1 for r in results or [] if r.get('status') == 'Error')

    return {
        'total': total,
        'sent': sent,
        'opened': opened,
        'clicked': clicked,
        'submitted_data': submitted_data,
        'error': error,
    }


def get_campaigns():
    campaigns = _request('GET', '/api/campaigns/')
    for c in campaigns or []:
        c['stats'] = _compute_campaign_stats(c.get('results'))
    return campaigns


def delete_campaign(campaign_id):
    return _request('DELETE', f'/api/campaigns/{campaign_id}')

def get_campaign(campaign_id):
    c = _request('GET', f'/api/campaigns/{campaign_id}')
    if c:
        c['stats'] = _compute_campaign_stats(c.get('results'))
    return c

def get_templates():
    return _request('GET', '/api/templates/')

def get_sending_profiles():
    return _request('GET', '/api/smtp/')

def get_pages():
    return _request('GET', '/api/pages/')

# ── Template management (bikin phishing pretext sendiri dari dashboard,
#    tanpa perlu buka GoPhish UI langsung) ──────────────────────────────

def create_template(name, subject, html, text=None):
    """Bikin email template baru di GoPhish. `html` boleh mengandung
    variabel GoPhish standar: {{.FirstName}}, {{.LastName}}, {{.Email}},
    {{.URL}}, {{.TrackingURL}} — GoPhish yang substitusi otomatis pas
    campaign dikirim, kita tidak perlu proses itu di sini."""
    payload = {
        "name": name,
        "subject": subject,
        "html": html,
        "text": text or "",
    }
    return _request('POST', '/api/templates/', payload)


def update_template(template_id, name, subject, html, text=None):
    payload = {
        "id": template_id,
        "name": name,
        "subject": subject,
        "html": html,
        "text": text or "",
    }
    return _request('PUT', f'/api/templates/{template_id}', payload)


def delete_template(template_id):
    return _request('DELETE', f'/api/templates/{template_id}')


# ── Landing page management ─────────────────────────────────────────────

def create_page(name, html, capture_credentials=True, capture_passwords=True, redirect_url=""):
    payload = {
        "name": name,
        "html": html,
        "capture_credentials": capture_credentials,
        "capture_passwords": capture_passwords,
        "redirect_url": redirect_url,
    }
    return _request('POST', '/api/pages/', payload)


def update_page(page_id, name, html, capture_credentials=True, capture_passwords=True, redirect_url=""):
    payload = {
        "id": page_id,
        "name": name,
        "html": html,
        "capture_credentials": capture_credentials,
        "capture_passwords": capture_passwords,
        "redirect_url": redirect_url,
    }
    return _request('PUT', f'/api/pages/{page_id}', payload)


def delete_page(page_id):
    return _request('DELETE', f'/api/pages/{page_id}')


def import_site(url, include_resources=False):
    """Clone HTML dari situs asli (misal portal SSO internal) lewat fitur
    bawaan GoPhish /api/import/site, buat dijadiin starting point landing
    page yang realistis. Hasilnya HTML mentah — masih perlu direview/
    diedit manual sebelum dipakai jadi landing page beneran (misal ubah
    form action, tambah field tersembunyi), makanya endpoint ini SENGAJA
    cuma return HTML-nya, bukan langsung bikin page di GoPhish."""
    payload = {
        "url": url,
        "include_resources": include_resources,
    }
    return _request('POST', '/api/import/site', payload)

def sync_group(name, emails):
    """Sinkronisasi group target GoPhish supaya isinya PERSIS sama dengan
    `emails` yang diberikan — bukan cuma nambahin.

    Kenapa loop delete, bukan cuma 1x + break: kalau karena sebab apapun
    ada lebih dari 1 group nyangkut dengan nama yang sama (misal delete
    gagal di percobaan sebelumnya), sisa yang gak ke-hapus bikin GoPhish
    resolve ke group yang SALAH pas campaign di-launch (bisa jadi group
    lama yang isinya target test sebelumnya, bukan target yang baru
    dipilih admin). Makanya kita hapus SEMUA yang namanya cocok, bukan
    cuma yang pertama ketemu.
    """
    # GET /api/groups/ to find existing
    groups = _request('GET', '/api/groups/')

    # DELETE *semua* group dengan nama yang sama (bukan cuma yang pertama)
    for group in groups or []:
        if group.get('name') == name:
            # NOTE: endpoint resmi GoPhish adalah /api/groups/:id (TANPA
            # trailing slash). Trailing slash bisa bikin request ini gak
            # match route DELETE sama sekali di sisi GoPhish, jadi group
            # lama gak beneran kehapus walau kelihatannya "jalan".
            _request('DELETE', f"/api/groups/{group.get('id')}")

    # Verifikasi bersih sebelum create baru — kalau masih ada sisa
    # group dengan nama sama, POST create di bawah bakal ditolak GoPhish
    # (nama group harus unik), jadi mending gagal eksplisit di sini
    # daripada create silently pakai nama beda/gagal ambigu.
    remaining = _request('GET', '/api/groups/')
    if any(g.get('name') == name for g in (remaining or [])):
        raise RuntimeError(
            f"Gagal membersihkan group GoPhish lama bernama '{name}' "
            f"sebelum sinkronisasi ulang — cek manual di GoPhish admin UI."
        )

    # POST /api/groups/ to create new (extracting first/last names from email format)
    targets = []
    for e in emails:
        local_part = e.split('@')[0]
        # Split by dot, underscore, or dash
        import re
        parts = re.split(r'[._-]', local_part)
        first_name = parts[0].capitalize() if parts else ""
        last_name = " ".join([p.capitalize() for p in parts[1:]]) if len(parts) > 1 else ""
        
        targets.append({
            "first_name": first_name,
            "last_name": last_name,
            "email": e,
            "position": ""
        })
    payload = {
        "name": name,
        "targets": targets
    }

    return _request('POST', '/api/groups/', payload)

def launch_campaign(name, template_id, url, page_id, smtp_id, group_name):
    # GoPhish API requires template, page, and smtp referenced by NAME.
    # We resolve IDs to names dynamically by querying GoPhish resources.
    def resolve_template(val):
        try:
            tid = int(val)
            for t in get_templates():
                if t.get('id') == tid:
                    return {"name": t.get('name')}
        except Exception:
            pass
        return {"name": str(val)}

    def resolve_page(val):
        try:
            pid = int(val)
            for p in get_pages():
                if p.get('id') == pid:
                    return {"name": p.get('name')}
        except Exception:
            pass
        return {"name": str(val)}

    def resolve_smtp(val):
        try:
            sid = int(val)
            for s in get_sending_profiles():
                if s.get('id') == sid:
                    return {"name": s.get('name')}
        except Exception:
            pass
        return {"name": str(val)}

    # Query group details to find target count for rate limiting calculations
    groups = _request('GET', '/api/groups/')
    target_count = 1
    for g in groups or []:
        if g.get('name') == group_name:
            target_count = len(g.get('targets', []))
            break

    from datetime import datetime, timedelta
    now_dt = datetime.utcnow()
    # Schedule campaign start time 120 seconds in the future to allow GoPhish to distribute sending and avoid SMTP rate limits
    launch_date_dt = now_dt + timedelta(seconds=120)
    # Spacing out sending window: at least 60s, or 90s per target to stay under SMTP limits
    # (90s interval verified working via manual GoPhish testing)
    send_by_dt = launch_date_dt + timedelta(seconds=max(60, target_count * 90))

    launch_date = launch_date_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    send_by_date = send_by_dt.strftime('%Y-%m-%dT%H:%M:%SZ')

    payload = {
        "name": name,
        "template": resolve_template(template_id),
        "url": url,
        "page": resolve_page(page_id),
        "smtp": resolve_smtp(smtp_id),
        "groups": [{"name": group_name}],
        "launch_date": launch_date,
        "send_by_date": send_by_date
    }
    
    return _request('POST', '/api/campaigns/', payload)