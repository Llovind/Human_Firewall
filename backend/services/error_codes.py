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
    # access requests
    ('must be at least', 'TEXT_TOO_SHORT'),
    ('must be at most', 'TEXT_TOO_LONG'),
    ('Enter the website address', 'INVALID_DOMAIN'),
    ('Unknown status filter', 'INVALID_FILTER'),
    ('Unknown kind', 'INVALID_FILTER'),
    ('Decision must be allow or deny', 'INVALID_DECISION'),
    ('already decided', 'ALREADY_DECIDED'),
    # incidents
    ('Send a status and/or an assignee', 'INVALID_PAYLOAD'),
    ('assignee must be', 'INVALID_PAYLOAD'),
    # education warnings
    ('Hanya SOC/GRC', 'FORBIDDEN'),
    ('sedang dinonaktifkan', 'FEATURE_DISABLED'),
    ('accountId wajib', 'INVALID_PAYLOAD'),
    ('Alasan warning wajib', 'REASON_REQUIRED'),
    ('Penerima harus employee', 'NOT_ELIGIBLE'),
    ('masih antre atau cooldown', 'ON_COOLDOWN'),
    # campaigns, templates, pages, thresholds
    ('Pilih minimal satu karyawan', 'NO_RECIPIENTS'),
    ('Tidak ada karyawan aktif', 'NO_RECIPIENTS'),
    ('Penerima harus karyawan aktif', 'NOT_ELIGIBLE'),
    ('Nama campaign wajib', 'NAME_REQUIRED'),
    ('URL harus alamat HTTP', 'INVALID_URL'),
    ('Gunakan base URL', 'INVALID_URL'),
    ('sending profile Mailpit', 'INVALID_VALUE'),
    ('Preset tidak valid', 'INVALID_VALUE'),
    ('Source campaign tidak valid', 'INVALID_VALUE'),
    ('Update rejected', 'INVALID_VALUE'),
    ('is required', 'FIELD_REQUIRED'),
    ('wajib diisi', 'INVALID_PAYLOAD'),
    ('JSON object', 'INVALID_PAYLOAD'),
    ('JSON body', 'INVALID_PAYLOAD'),
    ('not found', 'NOT_FOUND'),
    ('tidak ditemukan', 'NOT_FOUND'),
    ('was not found', 'NOT_FOUND'),
    ('Failed to', 'SERVER_ERROR'),
    ('gagal ', 'SERVER_ERROR'),
    # temporary failures
    ('Try again', 'TEMPORARILY_UNAVAILABLE'),
    ('coba kembali', 'TEMPORARILY_UNAVAILABLE'),
    ('belum diterima', 'TEMPORARILY_UNAVAILABLE'),
    ('belum tersedia', 'TEMPORARILY_UNAVAILABLE'),
    ('unavailable', 'TEMPORARILY_UNAVAILABLE'),
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
