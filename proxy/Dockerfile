FROM ubuntu:24.04

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       ca-certificates python3 squid-openssl squidclient \
    && rm -rf /var/lib/apt/lists/*

COPY squid.conf /etc/squid/squid.conf
COPY afferent_acl_helper.py /usr/local/bin/afferent_acl_helper.py
COPY ERR_AFFERENT_BLOCK /usr/share/squid/errors/en/ERR_AFFERENT_BLOCK
COPY ERR_AFFERENT_PROBE /usr/share/squid/errors/en/ERR_AFFERENT_PROBE

# Initialise the SSL certificate database at build time.
# /var/lib/squid MUST be explicitly created first because Ubuntu's squid-openssl
# package does not pre-create it, causing security_file_certgen to fail.
RUN chmod 0755 /usr/local/bin/afferent_acl_helper.py \
    && mkdir -p /etc/squid/ssl_cert \
    && chmod 700 /etc/squid/ssl_cert \
    && mkdir -p /var/lib/squid \
    && /usr/lib/squid/security_file_certgen -c -s /var/lib/squid/ssl_db -M 4MB \
    && chown -R proxy:proxy /var/lib/squid \
    && chmod 755 /var/lib/squid \
    && chmod 700 /var/lib/squid/ssl_db

EXPOSE 3128
CMD ["sh", "-c", "rm -f /run/squid.pid && exec squid -NYCd 1"]
