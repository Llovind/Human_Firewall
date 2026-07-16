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

def get_campaigns():
    return _request('GET', '/api/campaigns/')

def get_templates():
    return _request('GET', '/api/templates/')

def get_sending_profiles():
    return _request('GET', '/api/smtp/')

def get_pages():
    return _request('GET', '/api/pages/')

def sync_group(name, emails):
    # GET /api/groups/ to find existing
    groups = _request('GET', '/api/groups/')
    
    # DELETE if exists
    for group in groups:
        if group.get('name') == name:
            _request('DELETE', f"/api/groups/{group.get('id')}/")
            break
            
    # POST /api/groups/ to create new
    targets = [{"first_name": "", "last_name": "", "email": e, "position": ""} for e in emails]
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

    payload = {
        "name": name,
        "template": resolve_template(template_id),
        "url": url,
        "page": resolve_page(page_id),
        "smtp": resolve_smtp(smtp_id),
        "groups": [{"name": group_name}]
    }
    
    return _request('POST', '/api/campaigns/', payload)
