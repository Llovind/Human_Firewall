#!/bin/sh
# docker-entrypoint.sh
# Fix permissions on the volume-mounted instance dir, then exec flask as flaskuser.
# The volume mount happens at container runtime (after build-time chown),
# so the mounted dir may be owned by root — this script fixes that.

set -e

# Fix ownership of volume-mounted instance dir (may be root after mount)
chown -R flaskuser:flaskuser /app/instance

# Drop privileges and exec flask
exec gosu flaskuser flask run --host=0.0.0.0 --port=5000
