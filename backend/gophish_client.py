import requests
import os

GOPHISH_API_KEY = os.environ.get('GOPHISH_API_KEY', '')
GOPHISH_API_URL = os.environ.get('GOPHISH_API_URL', 'https://gophish:3333')
GOPHISH_CA_BUNDLE = os.environ.get('GOPHISH_CA_BUNDLE', '').strip()

def _request(method, endpoint, payload=None):
    url = f"{GOPHISH_API_URL.rstrip('/')}{endpoint}"
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {GOPHISH_API_KEY}'
    }
    
    response = requests.request(
        method=method, 
        url=url, 
        json=payload, 
        headers=headers, 
        # Strict verification is the default. For a private/self-signed CA,
        # mount the CA certificate and configure GOPHISH_CA_BUNDLE.
        verify=GOPHISH_CA_BUNDLE or True
    )
    
    response.raise_for_status()
    
    if response.text:
        return response.json()
    return {}

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

def create_page(name, html, capture_credentials=True, capture_passwords=True, redirect_url=""):
    payload = {
        "name": name,
        "html": html,
        "capture_credentials": capture_credentials,
        "capture_passwords": capture_passwords,
        "redirect_url": redirect_url
    }
    return _request('POST', '/api/pages', payload)

def update_page(page_id, name, html, capture_credentials=True, capture_passwords=True, redirect_url=""):
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
    
    # DELETE if exists
    for group in groups:
        if group.get('name') == name:
            _request('DELETE', f"/api/groups/{group.get('id')}")
            break
            
    # POST /api/groups to create new
    targets = [{"first_name": "", "last_name": "", "email": e, "position": ""} for e in emails]
    payload = {
        "name": name,
        "targets": targets
    }
    
    return _request('POST', '/api/groups', payload)

def launch_campaign(name, template_id, url, page_id, smtp_id, group_name):
    def make_ref(val):
        try:
            return {"id": int(val)}
        except ValueError:
            return {"name": str(val)}

    payload = {
        "name": name,
        "template": make_ref(template_id),
        "url": url,
        "page": make_ref(page_id),
        "smtp": make_ref(smtp_id),
        "groups": [{"name": group_name}]
    }
    
    return _request('POST', '/api/campaigns', payload)
