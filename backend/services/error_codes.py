"""Stable codes for the plain-text errors raised by the report and scan services.

The dashboard shows a sentence in the person's own language for each code, so the English text stays
only as a fallback for other clients. Matching is by phrase because the services raise ValueError(text)."""

_PHRASES = (
    ('Limit reached', 'RATE_LIMITED'),
    ('Description must be at most', 'DESCRIPTION_TOO_LONG'),
    ('already being processed', 'IN_PROGRESS'),
    ('Confirm that this non-confidential file', 'CONSENT_REQUIRED'),
    ('Choose a file', 'FILE_REQUIRED'),
    ('File must be at most', 'FILE_TOO_LARGE'),
    ('The file is empty', 'FILE_EMPTY'),
    ('queue is full', 'QUEUE_FULL'),
    ('URL wajib diisi', 'INVALID_URL'),
    ('karakter kontrol', 'INVALID_URL'),
    ('tanpa kredensial', 'INVALID_URL'),
)


def code_for(message: str) -> str | None:
    text = str(message)
    for phrase, code in _PHRASES:
        if phrase in text:
            return code
    return None


def error_body(message, fallback_code: str | None = None) -> dict:
    """{'error': text, 'code': code} where the code is known, otherwise only the text."""
    text = str(message)
    code = code_for(text) or fallback_code
    return {'error': text, **({'code': code} if code else {})}
