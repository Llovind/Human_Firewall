"""Render an offline-safe Squid denial page. No remote font or asset request."""
import base64
import os
from html import escape
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path('/usr/local/share/afferent')


def render(template, font, portal=''):
    action = '<p class="lead">Open AFFERENT from a trusted bookmark.</p>'
    if portal:
        parts = urlsplit(portal)
        if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or any(c.isspace() for c in portal):
            raise ValueError('PROXY_PORTAL_URL must be a public-facing HTTP(S) dashboard URL')
        # Squid interprets percent codes in templates; escape URL percent signs.
        target = escape(portal, quote=True).replace('%', '%%')
        action = f'<a class="primary" href="{target}">Open dashboard <span aria-hidden="true">→</span></a>'
    return template.replace('__POPPINS_FONT__', base64.b64encode(font).decode('ascii')).replace('__PORTAL_ACTION__', action)


def main():
    portal = os.environ.get('PROXY_PORTAL_URL', '').strip()
    if not portal:
        base = urlsplit(os.environ.get('SERVER_BASE_URL', ''))
        if base.hostname:
            host = f'[{base.hostname}]' if ':' in base.hostname else base.hostname
            portal = urlunsplit((base.scheme, host + ':3000', '', '', ''))
    html = render((ROOT / 'ERR_AFFERENT_BLOCK.template').read_text(encoding='utf-8'),
                  (ROOT / 'assets/Poppins-Regular.woff2').read_bytes(), portal)
    Path('/usr/share/squid/errors/en/ERR_AFFERENT_BLOCK').write_text(html, encoding='utf-8')


if __name__ == '__main__':
    main()
