import requests
import os
from email.utils import parseaddr

GOPHISH_API_KEY = os.environ.get('GOPHISH_API_KEY', '')
GOPHISH_API_URL = os.environ.get('GOPHISH_API_URL', 'https://gophish:3333')
GOPHISH_CA_BUNDLE = os.environ.get('GOPHISH_CA_BUNDLE', '').strip()

class GoPhishError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status

def _request(method, endpoint, payload=None):
    # GoPhish's collection routes require a trailing slash. Avoid a redirect
    # that can change POST into GET or forward the API credential elsewhere.
    if endpoint in ('/api/templates', '/api/pages', '/api/smtp', '/api/groups', '/api/campaigns'):
        endpoint += '/'
    url = f"{GOPHISH_API_URL.rstrip('/')}{endpoint}"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {GOPHISH_API_KEY}'
    }
    
    if not GOPHISH_API_KEY:
        raise GoPhishError('GOPHISH_API_KEY belum diisi.', 503)
    try:
        response = requests.request(
            method=method,
            url=url,
            json=payload,
            headers=headers,
            # Strict verification is the default. For a private/self-signed CA,
            # mount the CA certificate and configure GOPHISH_CA_BUNDLE.
            verify=GOPHISH_CA_BUNDLE or True,
            timeout=(3, 8),
            allow_redirects=False,
        )
    except requests.exceptions.SSLError as exc:
        raise GoPhishError('TLS GoPhish gagal diverifikasi. Periksa CA bundle dan SAN sertifikat.', 503) from exc
    except requests.RequestException as exc:
        raise GoPhishError('GoPhish belum dapat dijangkau. Periksa layanan dan alamat API.', 503) from exc
    try:
        result = response.json() if response.text else {}
    except ValueError as exc:
        raise GoPhishError('Respons GoPhish bukan JSON yang valid.') from exc
    if not response.ok or response.is_redirect:
        if response.status_code in (401, 403):
            raise GoPhishError('API key GoPhish tidak valid atau tidak memiliki akses.', 503)
        message = result.get('message', 'GoPhish menolak permintaan.') if isinstance(result, dict) else 'GoPhish menolak permintaan.'
        raise GoPhishError(str(message), 400 if response.status_code == 400 else 502)
    return result

def get_campaigns():
    return _request('GET', '/api/campaigns')

def get_campaign(campaign_id):
    return _request('GET', f'/api/campaigns/{campaign_id}')

def delete_campaign(campaign_id):
    return _request('DELETE', f'/api/campaigns/{campaign_id}')

def complete_campaign(campaign_id):
    return _request('GET', f'/api/campaigns/{campaign_id}/complete')

def get_templates():
    return _request('GET', '/api/templates')

def create_template(name, subject, html, text=""):
    payload = {"name": name, "subject": subject, "html": html, "text": text}
    return _request('POST', '/api/templates', payload)

def update_template(template_id, name, subject, html, text=""):
    payload = {"id": template_id, "name": name, "subject": subject, "html": html, "text": text}
    return _request('PUT', f'/api/templates/{template_id}', payload)

def delete_template(template_id):
    return _request('DELETE', f'/api/templates/{template_id}')

def get_sending_profiles():
    return _request('GET', '/api/smtp')

def get_pages():
    return _request('GET', '/api/pages')

def create_page(name, html, capture_credentials=False, capture_passwords=False, redirect_url=""):
    payload = {
        "name": name,
        "html": html,
        "capture_credentials": capture_credentials,
        "capture_passwords": capture_passwords,
        "redirect_url": redirect_url
    }
    return _request('POST', '/api/pages', payload)

def update_page(page_id, name, html, capture_credentials=False, capture_passwords=False, redirect_url=""):
    payload = {
        "id": page_id,
        "name": name,
        "html": html,
        "capture_credentials": capture_credentials,
        "capture_passwords": capture_passwords,
        "redirect_url": redirect_url
    }
    return _request('PUT', f'/api/pages/{page_id}', payload)

def delete_page(page_id):
    return _request('DELETE', f'/api/pages/{page_id}')

def import_site(url, include_resources=False):
    payload = {"url": url, "include_resources": include_resources}
    return _request('POST', '/api/import/site', payload)

def sync_group(name, emails):
    # GET /api/groups to find existing
    groups = _request('GET', '/api/groups')
    
    targets = [{"first_name": e.split('@')[0], "last_name": "", "email": e, "position": ""} for e in emails]
    for group in groups:
        if group.get('name') == name:
            return _request('PUT', f"/api/groups/{group['id']}", {"id": group['id'], "name": name, "targets": targets})
            
    # POST /api/groups to create new
    payload = {
        "name": name,
        "targets": targets
    }
    
    return _request('POST', '/api/groups', payload)

def launch_campaign(name, template_id, url, page_id, smtp_id, group_name):
    payload = {
        "name": name,
        "template": {"name": resolve_resource(get_templates(), template_id, 'Template')['name']},
        "url": url,
        "page": {"name": resolve_resource(get_pages(), page_id, 'Landing page')['name']},
        "smtp": {"name": resolve_resource(get_sending_profiles(), smtp_id, 'Sending profile')['name']},
        "groups": [{"name": group_name}]
    }
    
    return _request('POST', '/api/campaigns', payload)


def resolve_resource(rows, value, label):
    match = next((r for r in rows if str(r.get('id')) == str(value) or r.get('name') == value), None)
    if not match:
        raise GoPhishError(f'{label} tidak ditemukan. Muat ulang resource dan pilih lagi.', 400)
    return match


def ensure_demo_resources():
    """Explicit, idempotent demo setup. No recipients, no campaign, no external mail."""
    if os.environ.get('APP_ENV', 'development') not in ('development', 'local', 'test'):
        raise GoPhishError('Resource demo hanya dapat disiapkan di local development.', 403)
    if os.environ.get('SMTP_HOST') != 'mailpit' or os.environ.get('SMTP_PORT', '1025') != '1025':
        raise GoPhishError('Setup demo memerlukan SMTP mailpit:1025, bukan server email eksternal.', 400)
    templates = get_templates()
    pages = get_pages()
    profiles = get_sending_profiles()
    if not templates:
        create_template('AFFERENT Lab - Security Verification', 'Verifikasi akses akun laboratorium',
            '<html><body><p>Halo {{.FirstName}},</p><p>Periksa akses akun lab melalui <a href="{{.URL}}">portal verifikasi</a>.</p>{{.Tracker}}</body></html>',
            'Halo {{.FirstName}}, periksa akses akun lab: {{.URL}}')
    if not pages:
        create_page('AFFERENT Lab - Awareness', '<html><head><title>AFFERENT Awareness</title></head><body><h1>Ini simulasi phishing AFFERENT</h1><p>Tautan ini digunakan untuk pelatihan lab. Jangan masukkan password asli. Periksa pengirim dan domain sebelum membuka tautan.</p></body></html>', False, False)
    if not any(p.get('name') == 'AFFERENT Mailpit Lab' for p in profiles):
        _request('POST', '/api/smtp', {'name': 'AFFERENT Mailpit Lab', 'interface_type': 'SMTP',
            # Some GoPhish builds reject display-name From headers; keep the
            # shared EmailService setting intact and pass only the mailbox.
            'host': 'mailpit:1025', 'from_address': parseaddr(os.environ.get('SMTP_FROM_ADDRESS') or 'simulation@afferent.test')[1],
            'username': '', 'password': '', 'ignore_cert_errors': False, 'headers': []})
    return {'message': 'Resource lab siap. Email GoPhish hanya ditangkap Mailpit.'}
