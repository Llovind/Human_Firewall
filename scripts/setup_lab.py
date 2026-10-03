"""Fresh-clone lab setup. Stdlib only; never overwrites ENV or certificates."""
import argparse
import ipaddress
import os
from pathlib import Path
import re
import secrets
import subprocess

ROOT = Path(__file__).resolve().parent.parent


def validate_host(host):
    try:
        address = ipaddress.ip_address(host)
        if address.version != 4:
            raise ValueError('Use IPv4 or a DNS hostname for this lab helper.')
    except ValueError:
        if not re.fullmatch(r'(?=.{1,253}$)[A-Za-z0-9]+(?:[A-Za-z0-9.-]*[A-Za-z0-9])?', host):
            raise ValueError('Expected an IPv4 address or DNS hostname, not a URL.')
        if ':' in host or any(not label or len(label) > 63 for label in host.split('.')):
            raise ValueError('Invalid server hostname.')
    return host


def initialize(directory, template, host):
    host = validate_host(host)
    if any((directory / name).exists() for name in ('.env', '.env.proxy.local')):
        raise ValueError('Existing ENV preserved. Edit it manually; do not rerun bootstrap.')
    values = {key: secrets.token_urlsafe(48) for key in (
        'SECRET_KEY', 'SERVICE_API_KEY', 'OTP_PEPPER', 'AUTH_AUDIT_PEPPER',
        'PROXY_DB_PASSWORD', 'REDIS_PASSWORD', 'PROXY_IDENTITY_PEPPER', 'ML_WEBHOOK_SECRET',
    )}
    values.update(
        APP_ENV='development',  # Authorized demo-material setup; debug/auth bypass remain OFF.
        ADMIN_PASSWORD='Af!' + secrets.token_urlsafe(24),
        NEXT_PUBLIC_BASE_URL=f'http://{host}:3000',
        NEXT_PUBLIC_API_URL=f'http://{host}:5000',
        SERVER_BASE_URL=f'http://{host}:5000',
        SIMULATION_BASE_URL=f'http://{host}:8080',
        GOPHISH_PHISH_PUBLIC_URL=f'http://{host}:8080',
        PUBLIC_PROXY_URL=f'http://{host}:3128',
        ALLOWED_ORIGINS=','.join(dict.fromkeys((f'http://{host}:3000', 'http://localhost:3000', 'http://127.0.0.1:3000'))),
        GOPHISH_API_KEY='',
    )
    content = re.sub(r'^([A-Z_]+)=.*$', lambda m: f'{m[1]}={values[m[1]]}' if m[1] in values else m[0], template, flags=re.M)
    proxy_values = {
        'POSTGRES_DB': 'afferent_proxy', 'POSTGRES_USER': 'afferent_proxy_app',
        'POSTGRES_PASSWORD': values['PROXY_DB_PASSWORD'],
        **{key: values[key] for key in ('PROXY_DB_PASSWORD', 'REDIS_PASSWORD', 'PROXY_IDENTITY_PEPPER', 'ML_WEBHOOK_SECRET')},
    }
    for name, body in (('.env', content), ('.env.proxy.local', '\n'.join(f'{k}={v}' for k, v in proxy_values.items()) + '\n')):
        with (directory / name).open('x', encoding='utf-8', newline='\n') as handle:
            handle.write(body)
        (directory / name).chmod(0o600)


def generate_certificates(host):
    host = validate_host(host)
    gophish = ROOT / 'secrets/gophish-pki'
    proxy = ROOT / 'proxy/ssl'
    if any(folder.exists() and any(folder.iterdir()) for folder in (gophish, proxy)):
        raise ValueError('Existing PKI preserved. This helper does not rotate trusted CAs.')
    image = 'afferent-lab-pki:local'
    subprocess.run(['docker', 'build', '-t', image, str(ROOT / 'proxy')], check=True)
    for folder in (gophish, proxy):
        folder.mkdir(parents=True, exist_ok=True)

    def openssl(folder, *args):
        owner = ['--user', f'{os.getuid()}:{os.getgid()}'] if os.name == 'posix' else []
        subprocess.run(['docker', 'run', '--rm', '--network', 'none', *owner,
                        '--mount', f'type=bind,source={folder},target=/pki',
                        '--entrypoint', 'openssl', image, *args], check=True)

    for folder, prefix, common_name in (
        (gophish, 'afferent-lab-ca', 'AFFERENT GoPhish Lab CA'),
        (proxy, 'afferent-proxy-ca', 'AFFERENT Proxy Lab CA'),
    ):
        openssl(folder, 'req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-days', '365',
                '-keyout', f'/pki/{prefix}.key', '-out', f'/pki/{prefix}.crt',
                '-subj', f'/CN={common_name}', '-addext', 'basicConstraints=critical,CA:TRUE',
                '-addext', 'keyUsage=critical,keyCertSign,cRLSign')
    san = 'DNS:gophish,DNS:localhost,IP:127.0.0.1'
    try:
        ipaddress.ip_address(host)
        san += f',IP:{host}'
    except ValueError:
        san += f',DNS:{host}'
    extensions = gophish / 'gophish-extensions.cnf'
    extensions.write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=' + san + '\n', encoding='utf-8')
    openssl(gophish, 'req', '-new', '-newkey', 'rsa:3072', '-nodes', '-subj', '/CN=gophish',
            '-keyout', '/pki/gophish-admin.key', '-out', '/pki/gophish-admin.csr')
    openssl(gophish, 'x509', '-req', '-days', '365', '-in', '/pki/gophish-admin.csr',
            '-CA', '/pki/afferent-lab-ca.crt', '-CAkey', '/pki/afferent-lab-ca.key', '-CAcreateserial',
            '-out', '/pki/gophish-admin.crt', '-extfile', '/pki/gophish-extensions.cnf')
    for folder in (gophish, proxy):
        for file in folder.glob('*.key'):
            file.chmod(0o600)
    if os.name == 'posix':
        # The pinned GoPhish image runs as app:app (1000:1000). Give that leaf
        # key to its reader; keep both CA signing keys private to the host owner.
        subprocess.run(['docker', 'run', '--rm', '--network', 'none',
                        '--mount', f'type=bind,source={gophish},target=/pki',
                        '--entrypoint', 'chown', image, '1000:1000', '/pki/gophish-admin.key'], check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server-host', default='127.0.0.1', help='Server IPv4/DNS, without protocol or port')
    parser.add_argument('--certificates', action='store_true', help='Generate new lab PKI only, using Docker OpenSSL')
    args = parser.parse_args()
    try:
        if args.certificates:
            generate_certificates(args.server_host)
            print('Lab PKI created. Install public CA certificates only on authorized lab clients.')
        else:
            initialize(ROOT, (ROOT / '.env.example').read_text(encoding='utf-8'), args.server_host)
            print('ENV created. Read your bootstrap password locally in .env; no secrets printed.')
            print('Next: generate certificates, start GoPhish, and set its API key. See README_SETUP.md.')
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f'Setup stopped; existing data preserved: {exc}\n')
