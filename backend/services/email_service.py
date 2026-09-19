"""Reusable SMTP delivery for OTP and future AFFERENT notifications."""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage


logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    """Raised when a configured SMTP server cannot accept a message."""


class EmailService:
    def __init__(self) -> None:
        self.host = os.environ.get("SMTP_HOST", "").strip()
        self.port = int(os.environ.get("SMTP_PORT", "587"))
        self.username = os.environ.get("SMTP_USER", "").strip()
        self.password = os.environ.get("SMTP_PASSWORD", "")
        self.from_address = os.environ.get(
            "SMTP_FROM_ADDRESS", "AFFERENT Security <security@afferent.local>"
        ).strip()
        self.security = os.environ.get("SMTP_SECURITY", "starttls").strip().lower()
        self.timeout = float(os.environ.get("SMTP_TIMEOUT_SECONDS", "10"))

        if self.security not in {"starttls", "ssl", "none"}:
            raise RuntimeError("SMTP_SECURITY must be starttls, ssl, or none")
        if not self.host:
            raise RuntimeError("SMTP_HOST is required for email OTP delivery")

    def send(self, *, to_address: str, subject: str, text: str, html: str) -> None:
        message = EmailMessage()
        message["From"] = self.from_address
        message["To"] = to_address
        message["Subject"] = subject
        message.set_content(text)
        message.add_alternative(html, subtype="html")

        try:
            if self.security == "ssl":
                client: smtplib.SMTP = smtplib.SMTP_SSL(
                    self.host,
                    self.port,
                    timeout=self.timeout,
                    context=ssl.create_default_context(),
                )
            else:
                client = smtplib.SMTP(self.host, self.port, timeout=self.timeout)

            with client:
                client.ehlo()
                if self.security == "starttls":
                    client.starttls(context=ssl.create_default_context())
                    client.ehlo()
                if self.username:
                    client.login(self.username, self.password)
                client.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            logger.error("SMTP delivery failed for recipient domain; message not sent")
            raise EmailDeliveryError("Email OTP tidak dapat dikirim") from exc

    def send_login_otp(self, *, to_address: str, otp_code: str, expires_minutes: int) -> None:
        subject = "Kode verifikasi masuk AFFERENT"
        text = (
            "Gunakan kode berikut untuk menyelesaikan proses masuk ke AFFERENT:\n\n"
            f"{otp_code}\n\n"
            f"Kode berlaku selama {expires_minutes} menit dan hanya dapat digunakan satu kali. "
            "Abaikan email ini jika Anda tidak melakukan proses masuk."
        )
        html = f"""
        <div style="font-family:Poppins,Arial,sans-serif;background:#f4f7fb;padding:32px;color:#122033">
          <div style="max-width:520px;margin:auto;background:white;border:1px solid #dce5ef;border-radius:16px;padding:32px">
            <div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:#1971c2">AFFERENT SECURITY</div>
            <h1 style="font-size:22px;margin:14px 0 8px">Verifikasi proses masuk</h1>
            <p style="line-height:1.6;color:#526174">Gunakan kode berikut untuk menyelesaikan proses masuk Anda.</p>
            <div style="font:700 34px/1.2 ui-monospace,monospace;letter-spacing:.24em;text-align:center;background:#eef6ff;border-radius:12px;padding:20px;margin:24px 0;color:#0b5cab">{otp_code}</div>
            <p style="line-height:1.6;color:#526174">Kode berlaku selama <strong>{expires_minutes} menit</strong> dan hanya dapat digunakan satu kali.</p>
            <p style="font-size:12px;color:#7b8797;margin-top:24px">Abaikan email ini jika Anda tidak melakukan proses masuk.</p>
          </div>
        </div>
        """
        self.send(to_address=to_address, subject=subject, text=text, html=html)
