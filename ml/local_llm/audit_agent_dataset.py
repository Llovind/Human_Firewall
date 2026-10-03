"""Audit user-supplied SFT data without trusting its prompts as instructions.

Only aggregate quality/provenance results are exported. No URLs are visited.
This audit does not endorse generated reasons, risk scores or liveness claims.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit

from prepare import hostname, registered_group


def audit(source, repo, frozen, output):
    if output.exists():
        raise ValueError('Audit output exists; do not overwrite evidence')
    categories, verdicts, scores, live, dl = [Counter() for _ in range(5)]
    hosts, urls = defaultdict(set), []
    unavailable_reasons = unavailable_threat_reasons = path_inputs = rows = 0
    rejected = Counter()
    for line in source.read_text(encoding='utf-8-sig').splitlines():
        if not line.strip():
            continue
        rows += 1
        try:
            item = json.loads(line)
            messages = item['messages']
            if not isinstance(messages, list) or not messages or any(
                not isinstance(message, dict) or not isinstance(message.get('content'), str)
                for message in messages
            ):
                raise ValueError('Invalid messages')
            user = next(message['content'] for message in messages if message['role'] == 'user')
            answer = json.loads(messages[-1]['content'])
            if messages[-1]['role'] != 'assistant' or not isinstance(answer, dict):
                raise ValueError('Invalid assistant output')
            category = answer.get('category')
            if category not in ('BENIGN', 'THREAT_PHISHING', 'THREAT_MALWARE', 'THREAT_OTHER'):
                raise ValueError('Unsupported category')
            match = re.search(r'^- URL:\s*(\S+)\s*$', user, re.MULTILINE)
            if not match:
                raise ValueError('Missing URL field')
            url = match.group(1)
            host = hostname(url)
        except (KeyError, ValueError, TypeError, StopIteration, UnicodeError):
            rejected['invalid_structure_or_hostname'] += 1
            continue
        hosts[host].add(category)
        urls.append(url)
        categories[category] += 1
        verdicts[str(answer.get('verdict'))] += 1
        scores[str(answer.get('risk_score'))] += 1
        live[str(answer.get('is_live_domain'))] += 1
        match = re.search(r'Char-BiLSTM Score:\s*([0-9.]+)', user)
        dl[match.group(1) if match else 'missing'] += 1
        parsed = urlsplit(url)
        path_inputs += int(parsed.path not in ('', '/') or bool(parsed.query))
        reason = str(answer.get('reasoning', '')).lower()
        mentions_unavailable = 'domain tidak aktif' in reason or 'dns failure' in reason
        unavailable_reasons += int(mentions_unavailable)
        unavailable_threat_reasons += int(mentions_unavailable and category != 'BENIGN')
    repo_urls, repo_hosts = set(), set()
    for split in ('train', 'val', 'test'):
        with (repo / 'dataset/processed' / (split + '.csv')).open(encoding='utf-8-sig', newline='') as handle:
            for row in csv.DictReader(handle):
                repo_urls.add(row['url'])
                try:
                    repo_hosts.add(hostname(row['url']))
                except (ValueError, UnicodeError):
                    continue
    overlap, group_overlap = {}, {}
    supplied_groups = {registered_group(host) for host in hosts}
    for split in ('train', 'val', 'test'):
        known = [json.loads(line) for line in (frozen / (split + '.jsonl')).read_text(encoding='utf-8').splitlines()]
        overlap[split] = len(set(hosts) & {row['hostname'] for row in known})
        group_overlap[split] = len(supplied_groups & {row['group'] for row in known})
    report = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'rows': rows,
        'rejected': dict(rejected), 'categoryCounts': dict(categories), 'verdictCounts': dict(verdicts),
        'riskScoreCounts': dict(scores), 'livenessClaimCounts': dict(live), 'bilstmScoreCounts': dict(dl),
        'uniqueHostnames': len(hosts), 'mixedCategoryHostnames': sum(len(labels) > 1 for labels in hosts.values()),
        'duplicateUrls': len(urls) - len(set(urls)), 'urlsAlreadyInRepository': sum(url in repo_urls for url in urls),
        'hostnamesAlreadyInRepository': len(set(hosts) & repo_hosts),
        'newHostnames': len(set(hosts) - repo_hosts), 'hostnameOverlapWithFrozenExperiment': overlap,
        'registeredDomainOverlapWithFrozenExperiment': group_overlap,
        'inputsWithPathOrQuery': path_inputs, 'reasonsMentioningDomainUnavailable': unavailable_reasons,
        'threatReasonsMentioningDomainUnavailable': unavailable_threat_reasons,
        'categoryLabelsNotPresent': ['gambling', 'adult'],
        'decision': 'quarantine_for_label_review_not_direct_training',
        'limitations': ['No source provenance or liveness evidence supplied in each row',
            'Fixed risk scores are not calibrated probabilities',
            'Domain unavailability alone is not evidence of phishing',
            'URL-level labels cannot automatically become domain-level policies',
            'Never import BLOCK/ALLOW targets as enforcement instructions',
            'Discard generated reasoning, scores and live claims from domain-only training']}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--repo', type=Path, default=Path('/work'))
    parser.add_argument('--frozen', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    audit(args.source, args.repo, args.frozen, args.output)
