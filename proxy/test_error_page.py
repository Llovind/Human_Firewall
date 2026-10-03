"""Offline denial-page regression check; --preview serves only test HTML."""
import sys
from pathlib import Path
from render_error_page import render, ROOT


def page():
    template = (ROOT / 'ERR_AFFERENT_BLOCK.template').read_text(encoding='utf-8')
    font = (ROOT / 'assets/Poppins-Regular.woff2').read_bytes()
    assert font[:4] == b'wOF2'
    html = render(template, font, 'http://lab.test:3000')
    assert '__POPPINS_FONT__' not in html and '__PORTAL_ACTION__' not in html
    assert 'data:font/woff2;base64,' in html
    assert 'fonts.googleapis.com' not in html and '<script' not in html
    assert '%H' in html and '%h' in html
    assert 'BLOCKED BY AFFERENT' in html
    assert '%%20' in render(template, font, 'http://lab.test:3000/a%20b')
    try:
        render(template, font, 'javascript:alert(1)')
    except ValueError:
        pass
    else:
        raise AssertionError('Unsafe portal URL accepted')
    print('PASS: offline Poppins, safe portal link, no raw request headers, responsive denial HTML')
    return html.replace('%H', 'blocked.afferent.test').replace('%h', 'AFFERENT Lab Gateway').replace('%%', '%')


if __name__ == '__main__':
    html = page()
    if '--preview' in sys.argv:
        from http.server import BaseHTTPRequestHandler, HTTPServer
        class Preview(BaseHTTPRequestHandler):
            def do_GET(self):
                body = html.replace('http://lab.test:3000', 'http://localhost:3000').encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        HTTPServer(('0.0.0.0', 8099), Preview).serve_forever()
