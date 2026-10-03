"""One demo worker drains persisted emails and checks low-score education."""
import logging
import os
import signal
import time
from pathlib import Path

from services.notification_service import deliver_one, queue_education


def main():
    logging.basicConfig(level=logging.INFO)
    stopped = False

    def stop(*_):
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    # Backend migrations finish first (Compose depends_on health).
    education_at = 0
    campaign_at = 0
    while not stopped:
        if os.environ.get('GOPHISH_SYNC_ENABLED', 'false').lower() == 'true' and time.monotonic() >= campaign_at:
            campaign_at = time.monotonic() + 10
            try:
                import database
                import gophish_client
                for campaign in gophish_client.get_campaigns():
                    database.sync_gophish_events(campaign)
            except Exception as exc:
                logging.error('Campaign telemetry retry: %s', type(exc).__name__)
        try:
            if os.environ.get('EDUCATION_EMAIL_ENABLED', 'true').lower() == 'true':
                if os.environ.get('EDUCATION_AUTO_ENABLED', 'false').lower() == 'true' and time.monotonic() >= education_at:
                    queue_education()
                    education_at = time.monotonic() + 60
                deliver_one()
            Path('/tmp/afferent-mail-heartbeat').touch()
        except Exception as exc:
            logging.error('Notification worker retry: %s', type(exc).__name__)
        time.sleep(1)


if __name__ == '__main__':
    main()
