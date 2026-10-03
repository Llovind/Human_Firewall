"""Mailpit-only simulation materials. No original credential collection."""
import ipaddress
import os
import re
import socket
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import requests
import gophish_client as gp

FORM = '''<form method="post" action="" autocomplete="off" class="afferent-demo-form">
<h2>Verifikasi perubahan password</h2><p>Masuk untuk melanjutkan verifikasi akun.</p>
<label for="demo-email">Email demo</label><input id="demo-email" type="email" autocomplete="off" required placeholder="nama@demo.test">
<label for="demo-password">Password demo</label><input id="demo-password" type="password" autocomplete="new-password" required placeholder="Gunakan password dummy, bukan password asli">
<button type="submit">Lanjutkan verifikasi</button>
<small>Laboratorium simulasi. Isi kolom email/password tidak dikirim atau disimpan.</small></form>'''
FORM_STYLE = '''.afferent-demo-form{box-sizing:border-box;max-width:440px;margin:24px auto;padding:32px;background:#fff;color:#10233f;border:1px solid #dce6f2;border-radius:20px;font:14px/1.6 Poppins,Arial,sans-serif}.afferent-demo-form h2{font-size:22px;margin:0 0 12px}.afferent-demo-form label{display:block;margin:16px 0 6px}.afferent-demo-form input:not([type=hidden]){box-sizing:border-box;width:100%;padding:12px;border:1px solid #c7d7eb;border-radius:8px;font:inherit}.afferent-demo-form button{width:100%;margin:24px 0 16px;padding:12px;border:0;border-radius:8px;background:#1a73e8;color:white;font:600 14px Poppins,Arial,sans-serif;cursor:pointer}.afferent-demo-form small{display:block;color:#52647d}'''
CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; object-src 'none'"


def education_url(value=None):
    if value is not None and not isinstance(value, str):
        raise gp.GoPhishError('Redirect URL harus berupa teks.', 400)
    value = (value or os.environ.get('SIMULATION_EDUCATION_URL', '')).strip()
    if not value:
        base = urlsplit(os.environ.get('SERVER_BASE_URL', ''))
        if not base.hostname:
            raise gp.GoPhishError('Isi SERVER_BASE_URL atau SIMULATION_EDUCATION_URL untuk halaman edukasi.', 503)
        host = f'[{base.hostname}]' if ':' in base.hostname else base.hostname
        value = urlunsplit((base.scheme, host + ':3000', '/simulation/education', '', ''))
    try:
        parsed = urlsplit(value)
        parsed.port  # Validate malformed ports before constructing a CSP source.
    except ValueError as exc:
        raise gp.GoPhishError('SIMULATION_EDUCATION_URL tidak valid.', 503) from exc
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or any(c.isspace() for c in value):
        raise gp.GoPhishError('SIMULATION_EDUCATION_URL harus URL HTTP/HTTPS yang bisa dibuka employee.', 503)
    try:
        ipaddress.ip_address(parsed.hostname)
    except ValueError:
        host = parsed.hostname.encode('idna').decode()
        if not re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?', host):
            raise gp.GoPhishError('Hostname redirect tidak valid.', 503)
    return value


def landing_csp(redirect=None):
    # Chromium also applies form-action to the POST's cross-origin 302 target.
    # Allow only our configured education origin, retaining all other guards.
    target = urlsplit(education_url(redirect))
    host = f'[{target.hostname}]' if ':' in target.hostname else target.hostname.encode('idna').decode()
    origin = urlunsplit((target.scheme, host + (f':{target.port}' if target.port else ''), '', '', ''))
    return CSP.replace("form-action 'self'", "form-action 'self' " + origin)


def repair_landing_csp(html, redirect=None):
    meta = '<meta http-equiv="Content-Security-Policy" content="' + escape(landing_csp(redirect), quote=True) + '">'
    pattern = r'''<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']Content-Security-Policy["'])[^>]*>'''
    if re.search(pattern, html, flags=re.I):
        return re.sub(pattern, lambda _: meta, html, flags=re.I)
    return html.replace('</head>', meta + '</head>', 1)


def prepare_password_reset():
    gp.ensure_demo_resources()
    redirect = education_url()
    directory = Path(__file__).resolve().parent.parent / 'templates'
    template_name = 'AFFERENT - Perubahan Password Mendadak'
    page_name = 'AFFERENT - Verifikasi Password Demo'
    template = next((t for t in gp.get_templates() if t['name'] == template_name), None)
    if not template:
        template = gp.create_template(template_name, 'Tindakan diperlukan: perubahan password akun Anda',
            (directory / 'campaign_password_email.html').read_text(encoding='utf-8'),
            'Halo {{.FirstName}}, kami menerima permintaan perubahan password akun {{.Email}}. Tinjau aktivitas akun melalui {{.URL}}. IT Account Services — simulasi lab.')
    page = next((p for p in gp.get_pages() if p['name'] == page_name), None)
    if not page:
        html = (directory / 'campaign_password_login.html').read_text(encoding='utf-8').replace('<!-- DEMO_FORM -->', FORM).replace('/* DEMO_STYLE */', FORM_STYLE)
        page = gp.create_page(page_name, repair_landing_csp(html, redirect), False, False, redirect)
    else:
        html = repair_landing_csp(page['html'], redirect)
        if page.get('redirect_url') != redirect or page.get('capture_credentials') or page.get('capture_passwords') or html != page['html']:
            page = gp.update_page(page['id'], page_name, html, False, False, redirect)
    return {'message': 'Template perubahan password dan form demo siap. Submit diarahkan ke edukasi.',
            'template_id': template['id'], 'page_id': page['id'], 'educationUrl': redirect}


class StaticLoginClone(HTMLParser):
    """Static visual clone only; discard source forms/scripts/navigation.

    ponytail: strict static allowlist, not a general browser/SPA reproducer.
    Multistep OAuth and JS-driven login must use the built-in demo instead.
    """
    allowed = set('div section main article aside header footer nav p span h1 h2 h3 h4 h5 h6 label strong b em i small ul ol li table tbody thead tr td th style br hr img'.split())
    blocked = set('script iframe object embed svg math noscript template textarea select button'.split())
    void = {'br', 'hr', 'img', 'input', 'link', 'meta', 'embed', 'source', 'wbr', 'base'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output, self.skip = [], []
        self.form_found = False
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        if self.skip:
            if tag not in self.void:
                self.skip.append(tag)
            return
        if tag == 'form':
            if not self.form_found:
                self.output.append(FORM)
                self.form_found = True
            self.skip = ['form']
            return
        if tag in self.blocked:
            if tag not in self.void:
                self.skip = [tag]
            return
        if tag not in self.allowed:
            return
        safe = []
        for key, value in attrs:
            if value is None:
                continue
            if key in ('class', 'id', 'style', 'title', 'alt', 'width', 'height', 'align', 'aria-label'):
                value = escape(value, quote=True).replace('{{', '&#123;&#123;')
                safe.append(f'{key}="{value}"')
            elif tag == 'img' and key == 'src' and re.fullmatch(r'data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+', value):
                safe.append(f'src="{value}"')
        self.output.append('<' + tag + (' ' + ' '.join(safe) if safe else '') + '>')
        if tag == 'style':
            self.in_style = True

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.void:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.skip:
            if tag in self.skip:
                self.skip = self.skip[:len(self.skip) - 1 - self.skip[::-1].index(tag)]
            return
        if tag in self.allowed and tag not in self.void:
            self.output.append('</' + tag + '>')
        if tag == 'style':
            self.in_style = False

    def handle_data(self, data):
        if not self.skip:
            self.output.append((data if self.in_style else escape(data)).replace('{{', '&#123;&#123;'))


def safe_clone(raw_html, redirect=None):
    parser = StaticLoginClone()
    parser.feed(raw_html)
    parser.close()
    if not parser.form_found:
        raise gp.GoPhishError('Tidak ditemukan form HTML statis. Login berbasis SPA/OAuth tidak bisa diclone utuh; gunakan template demo.', 422)
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="' + escape(landing_csp(redirect), quote=True) + '"><title>Verifikasi akun lab</title><style>' + FORM_STYLE + '</style></head><body>' + ''.join(parser.output) + '</body></html>'


def simulation_page_html(html, redirect=None):
    # Replace any submitted form with the same credential-free demo, including
    # manually edited HTML. GoPhish records POST fields even with capture off.
    if not isinstance(html, str):
        raise gp.GoPhishError('HTML harus berupa teks.', 400)
    parser = StaticLoginClone()
    parser.feed(html)
    return safe_clone(html, redirect) if parser.form_found else html


def clone_with_firecrawl(url, authorized):
    if authorized is not True:
        raise gp.GoPhishError('Konfirmasi bahwa halaman milik sendiri atau diizinkan untuk simulasi.', 400)
    if not isinstance(url, str) or len(url) > 2048:
        raise gp.GoPhishError('URL tidak valid.', 400)
    try:
        parsed = urlsplit(url)
    except ValueError as exc:
        raise gp.GoPhishError('URL tidak valid.', 400) from exc
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise gp.GoPhishError('Gunakan URL publik HTTP/HTTPS tanpa credential, query token, atau fragment.', 400)
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('non-public')
    except (OSError, ValueError) as exc:
        raise gp.GoPhishError('Firecrawl cloud memerlukan URL publik, bukan localhost/IP lab/private.', 400) from exc
    key = os.environ.get('FIRECRAWL_API_KEY', '').strip()
    if not key:
        raise gp.GoPhishError('FIRECRAWL_API_KEY belum terbaca backend. Recreate layanan setelah mengubah .env.', 503)
    redirect = education_url()
    try:
        response = requests.post('https://api.firecrawl.dev/v2/scrape',
            headers={'Authorization': 'Bearer ' + key},
            json={'url': url, 'formats': ['rawHtml'], 'onlyMainContent': False, 'timeout': 25000},
            timeout=(5, 30), allow_redirects=False)
        if not response.ok:
            messages = {401: 'API key Firecrawl tidak valid.', 402: 'Kredit Firecrawl tidak cukup.', 429: 'Rate limit Firecrawl; coba lagi nanti.'}
            raise gp.GoPhishError(messages.get(response.status_code, 'Firecrawl menolak scrape. Periksa izin dan akses halaman.'), 502)
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise gp.GoPhishError('Firecrawl gagal merespons. Tidak ada fallback clone atau hasil sukses palsu.', 502) from exc
    if not isinstance(payload, dict) or not isinstance(payload.get('data'), dict):
        raise gp.GoPhishError('Format respons Firecrawl tidak valid.', 502)
    data = payload['data']
    raw = data.get('rawHtml')
    metadata = data.get('metadata') or {}
    status = metadata.get('statusCode', 200) if isinstance(metadata, dict) else 500
    if not payload.get('success') or not isinstance(raw, str) or not raw.strip() or len(raw.encode('utf-8')) > 1_500_000 or not isinstance(status, int) or status >= 400:
        raise gp.GoPhishError('Firecrawl tidak menghasilkan HTML login yang dapat dipakai (kosong, error, atau terlalu besar).', 422)
    return {'html': safe_clone(raw, redirect), 'provider': 'firecrawl', 'redirect_url': redirect,
            'capture_credentials': False, 'capture_passwords': False,
            'message': 'Clone statis siap ditinjau. Script, form asli dan koneksi eksternal dihapus; form diganti dengan demo tanpa menyimpan credential.'}
