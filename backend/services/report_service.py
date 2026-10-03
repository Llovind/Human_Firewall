"""SOC link reports and private employee file scans; no automatic enforcement."""
import hashlib
import json
import os
import time
import uuid
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor

import database
import integrations
from services import ml_service, proxy_store
from werkzeug.utils import secure_filename


def file_max_bytes():
    # Legacy variables remain a fallback for existing lab environments.
    return max(1, min(10, int(os.environ.get('FILE_SCAN_MAX_MB') or os.environ.get('PDF_REPORT_MAX_MB', '10')))) * 1024 * 1024


def _combine(results, normalizers, version=2):
    evidence, statuses = {}, {}
    for result, normalize in zip(results, normalizers):
        if not isinstance(result, dict) or not isinstance(result.get('provider'), str):
            # Fixed provider order; malformed responses cannot become clean.
            provider = 'virustotal' if normalize in (integrations.normalize_virustotal, integrations.normalize_vt_file) else 'urlscan'
            result = {'success': False, 'provider': provider, 'status_code': 502}
        try:
            item = normalize(result)
        except (TypeError, ValueError, AttributeError, KeyError):
            item = None
            result = {'success': False, 'provider': result['provider'], 'status_code': 502}
        if item:
            evidence[item['provider']] = item
        statuses[result['provider']] = integrations.provider_status(result)
    ranking = {'clean': 1, 'suspicious': 2, 'malicious': 3}
    decisive = [item for item in evidence.values() if item['verdict'] != 'unknown']
    strongest = max(decisive, key=lambda item: ranking[item['verdict']], default=None)
    return {'analysisVersion': version, 'providerStatus': statuses,
        'providers': list(evidence), 'evidence': evidence,
        'verdict': strongest['verdict'] if strongest else 'unknown',
        'severity': strongest['severity'] if strongest else 'medium',
        'confidence': strongest['confidence'] if strongest else None,
        'recommendation': 'Review'}


def analyze_url(url):
    """Shared reputation lookup for Scan URL and Report a link; no ML or rewards."""
    url = ml_service.validate_url(url)
    cached = database.get_cached_indicator(url)
    try:
        analysis = json.loads(cached.get('raw_json') or '{}') if cached else {}
    except (ValueError, TypeError):
        analysis = {}
    if analysis.get('analysisVersion') == 2:
        return analysis
    with ThreadPoolExecutor(max_workers=2) as pool:
        tasks = [(provider, pool.submit(scan, url)) for provider, scan in (
            ('virustotal', integrations.scan_virustotal), ('urlscan', integrations.scan_urlscan))]
        results = []
        for provider, task in tasks:
            try:
                results.append(task.result())
            except Exception:
                results.append({'success': False, 'provider': provider, 'status_code': 502})
    analysis = _combine(results, (integrations.normalize_virustotal, integrations.normalize_urlscan))
    if analysis['evidence']:
        database.save_threat_cache(url, 'url', analysis)
    return analysis


def rate_limit(identity, kind='report'):
    redis = proxy_store.redis_client()
    key = f'{kind}:rate:{identity.account_id}:{int(time.time()) // 3600}'
    count = redis.incr(key)
    if count == 1:
        redis.expire(key, 3600)
    if count > 20:
        raise ValueError('Limit reached: 20 requests per hour. Try again later.')


def _serialized(row):
    result = dict(row)
    result['analysis'] = json.loads(result.pop('analysis_json'))
    result.pop('payload', None)
    result['status'] = 'submitted'
    if result.get('soc_alert_id'):
        alert = proxy_store.get_alert(result['soc_alert_id'])
        if alert:
            result['status'] = {'open': 'under review', 'blocked': 'resolved', 'allowed': 'false positive'}.get(alert['status'], 'submitted')
    return result


def list_reports(identity):
    with closing(database.get_connection()) as conn:
        rows = conn.execute("SELECT * FROM employee_url_reports WHERE account_id=? AND report_type='url' ORDER BY created_at DESC LIMIT 100", (identity.account_id,)).fetchall()
    return [_serialized(row) for row in rows]


def _serialized_file(row):
    result = dict(row)
    result['analysis'] = json.loads(result.pop('analysis_json'))
    result.pop('payload', None)
    done = result.pop('done', 0)
    result['status'] = ('completed' if result['verdict'] != 'unknown' else 'unknown') if done else 'pending'
    return result


def list_file_scans(identity):
    with closing(database.get_connection()) as conn:
        rows = conn.execute('''SELECT s.*, COALESCE(j.done,1) AS done FROM employee_file_scans s
            LEFT JOIN file_analysis_jobs j ON j.scan_id=s.id
            WHERE s.account_id=? ORDER BY s.created_at DESC,s.id LIMIT 100''', (identity.account_id,)).fetchall()
    return [_serialized_file(row) for row in rows]


def submit(identity, url, description, request_id):
    url = ml_service.validate_url(url)
    if not isinstance(description, str) or len(description) > 2000:
        raise ValueError('Description must be at most 2000 characters.')
    digest = hashlib.sha256(f'{identity.account_id}:{url}'.encode()).hexdigest()
    # Token-owned Redis lock also covers separate gunicorn processes.
    lock = proxy_store.redis_client().lock(f'report:lock:{digest}', timeout=30, blocking_timeout=0)
    if not lock.acquire():
        raise RuntimeError('This report is already being processed. Try again shortly.')
    try:
        with closing(database.get_connection()) as conn:
            existing = conn.execute('SELECT * FROM employee_url_reports WHERE account_id=? AND url=?', (identity.account_id, url)).fetchone()
        if existing:
            return {'report': _serialized(existing), 'duplicate': True}
        rate_limit(identity)
        analysis = analyze_url(url)
        if not analysis.get('verdict'):
            raise ValueError('Cached intelligence is invalid.')
        from services.proxy_service import normalize_domain
        report_id = str(uuid.uuid5(uuid.NAMESPACE_URL, digest))
        alert = proxy_store.create_alert({
            'id': report_id, 'domain': normalize_domain(url), 'device_id': None,
            'account_id': identity.account_id, 'employee_email': identity.email,
            'urgency': 'Critical' if analysis['verdict'] == 'malicious' else 'Unknown',
            'verdict': 'malicious' if analysis['verdict'] == 'malicious' else 'unknown',
            'reason': f"Employee report: {url[:500]}. {description[:300]}. Evidence: {', '.join(analysis.get('providers', [])) or 'unavailable'}",
            'confidence': analysis['confidence'] / 100 if analysis.get('confidence') is not None else None,
            'source': 'employee_report', 'request_id': request_id,
        })
        # One transaction owns report, reward ledger, points and badge counters.
        with closing(database.get_connection()) as conn, conn:
            conn.execute('BEGIN IMMEDIATE')
            reward = database.award_threat_reward(identity.email, url, analysis['verdict'], connection=conn)
            if analysis['verdict'] in database.VALID_VERDICTS:
                database.create_threat_report(identity.email, None, 'url', url, analysis['verdict'],
                                             analysis['severity'], 'both', raw_scores=analysis, connection=conn)
            conn.execute('INSERT INTO employee_url_reports (id, account_id, email, url, description, verdict, analysis_json, soc_alert_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                         (report_id, identity.account_id, identity.email, url, description.strip(), analysis['verdict'], json.dumps(analysis), str(alert['id'])))
            row = conn.execute('SELECT * FROM employee_url_reports WHERE id=?', (report_id,)).fetchone()
        return {'report': _serialized(row), 'reward': reward, 'duplicate': False}
    finally:
        lock.release()


def submit_file_scan(identity, upload, consent, request_id):
    if consent != 'true':
        raise ValueError('Confirm that this non-confidential file may be shared with VirusTotal.')
    if upload is None or not upload.filename:
        raise ValueError('Choose a file.')
    payload = upload.stream.read(file_max_bytes() + 1)
    if len(payload) > file_max_bytes():
        raise ValueError(f'File must be at most {file_max_bytes() // 1024 // 1024} MB.')
    if not payload:
        raise ValueError('The file is empty.')
    # These are opaque quarantined bytes, not sanitized files. Never parse, run,
    # preview or expose these bytes to another user, including SOC.
    digest = hashlib.sha256(payload).hexdigest()
    scan_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f'file-scan:{identity.account_id}:{digest}'))
    file_name = secure_filename(upload.filename)[:180] or 'sample.bin'
    rate_limit(identity, 'file-scan')
    now = int(time.time())
    analysis = {'analysisVersion': 3, 'providers': [], 'evidence': {}, 'verdict': 'unknown',
                'confidence': None, 'severity': 'medium', 'recommendation': 'Review',
                'providerStatus': {'virustotal': {'state': 'queued', 'statusCode': 0}}}
    with closing(database.get_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        existing = conn.execute('''SELECT s.*, COALESCE(j.done,1) AS done FROM employee_file_scans s
            LEFT JOIN file_analysis_jobs j ON j.scan_id=s.id
            WHERE s.account_id=? AND s.file_sha256=?''', (identity.account_id, digest)).fetchone()
        if existing:
            return {'scan': _serialized_file(existing), 'duplicate': True}
        total = conn.execute('SELECT COALESCE(SUM(length(payload)),0) FROM file_analysis_jobs').fetchone()[0]
        if total + len(payload) > 64 * 1024 * 1024:
            raise ValueError('File scan queue is full. Try again after pending analyses finish.')
        conn.execute('''INSERT INTO employee_file_scans
            (id,account_id,file_name,file_sha256,file_size,verdict,analysis_json)
            VALUES (?,?,?,?,?,'unknown',?)''',
            (scan_id, identity.account_id, file_name, digest, len(payload), json.dumps(analysis)))
        retention = max(300, min(86400, int(os.environ.get('FILE_SCAN_RETENTION_SECONDS') or os.environ.get('PDF_REPORT_RETENTION_SECONDS', '3600'))))
        conn.execute('''INSERT INTO file_analysis_jobs (scan_id,payload,expires_at,request_id)
            VALUES (?,?,?,?)''', (scan_id, payload, now + retention, request_id))
        row = conn.execute('SELECT s.*,0 AS done FROM employee_file_scans s WHERE id=?', (scan_id,)).fetchone()
    return {'scan': _serialized_file(row), 'duplicate': False}


def process_file_one():
    """Durable async hash lookup -> optional upload -> bounded polling.

    No new automatic upload after an ambiguous upload failure (the provider
    may already have accepted it). Keep Unknown for the employee, not SOC.
    """
    now = int(time.time())
    with closing(database.get_connection()) as conn, conn:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute('''SELECT j.*, s.file_sha256, s.analysis_json
            FROM file_analysis_jobs j JOIN employee_file_scans s ON s.id=j.scan_id
            WHERE j.done=0 AND j.available_at<=? AND j.lease_until<=?
            ORDER BY j.available_at,j.scan_id LIMIT 1''', (now, now)).fetchone()
        if not row:
            return False
        conn.execute('UPDATE file_analysis_jobs SET lease_until=?,attempts=attempts+1 WHERE scan_id=?',
                     (now + 90, row['scan_id']))
    analysis_id, payload, done = row['analysis_id'], row['payload'], False
    try:
        if row['expires_at'] <= now or row['attempts'] >= 30:
            result = {'provider': 'virustotal', 'success': False, 'state': 'expired', 'status_code': 408}
            done = True
        elif analysis_id:
            result = integrations.poll_vt_analysis(analysis_id)
        else:
            result = integrations.scan_vt_file_hash(row['file_sha256'])
            if result.get('status_code') == 404 and payload is not None:
                result = integrations.upload_vt_file(payload)
                # Stop retrying the bytes even on uncertain network outcomes.
                # A locally throttled upload never sent any bytes; retry it.
                if result.get('status_code') != 429:
                    payload = None
                if result.get('success'):
                    analysis_id = ((result.get('data') or {}).get('data') or {}).get('id')
                    if not isinstance(analysis_id, str):
                        result.update(success=False, status_code=502)
                        done = True
                elif result.get('status_code') != 429:
                    done = True
        evidence = integrations.normalize_vt_file(result)
        if evidence and not analysis_id:
            done = True
        if analysis_id and result.get('success'):
            attributes = ((result.get('data') or {}).get('data') or {}).get('attributes') or {}
            if attributes.get('status') == 'completed':
                done = True
            elif evidence is None:
                result['state'] = 'pending'
        analysis = _combine([result], [integrations.normalize_vt_file], version=3)
        if analysis_id:
            analysis['analysisId'] = analysis_id
    except Exception:
        # Never expose provider responses, file contents, or credentials in logs.
        analysis = json.loads(row['analysis_json'])
        analysis['providerStatus'] = {'virustotal': {'state': 'unavailable', 'statusCode': 502}}
    if done:
        payload = None
    with closing(database.get_connection()) as conn, conn:
        conn.execute('''UPDATE employee_file_scans SET verdict=?,analysis_json=? WHERE id=?''',
                     (analysis['verdict'], json.dumps(analysis), row['scan_id']))
        conn.execute('''UPDATE file_analysis_jobs SET payload=?,analysis_id=?,done=?,lease_until=0,
            available_at=? WHERE scan_id=?''', (payload, analysis_id, int(done), now + 60, row['scan_id']))
    # Private file scans do not publish SOC events, mint points or write domain policies. Existing URL
    # report rewards stay in submit(), with their original daily cap.
    return True
