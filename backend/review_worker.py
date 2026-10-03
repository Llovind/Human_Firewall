"""Private file scans and local SOC reviews; isolated from OTP/mail/proxy requests."""
import logging
import signal
import time
from pathlib import Path

from services import report_service, local_llm_service


def main():
    stopped = False

    def stop(*_):
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    logging.basicConfig(level=logging.INFO)
    while not stopped:
        for work in (report_service.process_file_one, local_llm_service.process_one):
            Path('/tmp/afferent-review-heartbeat').touch()
            try:
                work()
            except Exception as exc:
                logging.warning('Review deferred: %s', type(exc).__name__)
        time.sleep(1)


if __name__ == '__main__':
    main()
