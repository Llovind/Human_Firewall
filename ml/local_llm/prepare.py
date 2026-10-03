"""Offline domain-only corpus. No crawls, HTML, paths, passwords or PII inputs."""
import argparse
import csv
import hashlib
import ipaddress
import json
import random
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit

import tldextract

from contract import LABELS, SYSTEM, messages

EXTRACTOR = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None, include_psl_private_domains=False)


def hostname(url):
    url = str(url).strip()
    if any(ord(char) <= 32 or ord(char) == 127 for char in url) or '\\' in url:
        raise ValueError('Invalid URL characters')
    parsed = urlsplit(url if '://' in url else 'https://' + url)
    host = (parsed.hostname or '').lower().rstrip('.').encode('idna').decode('ascii')
    if parsed.scheme not in ('http', 'https') or parsed.username is not None or parsed.password is not None:
        raise ValueError('Unsupported scheme or credentials')
    parsed.port  # Reject malformed ports even though only the hostname is retained.
    if '.' not in host or re.fullmatch(r'[0-9.]+', host) or not re.fullmatch(r'[a-z0-9.-]+', host) or len(host) > 253 or any(not label or len(label) > 63 or label.startswith('-') or label.endswith('-') for label in host.split('.')):
        raise ValueError('Invalid hostname')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return host
    raise ValueError('IP-only URL has no hostname category evidence')


def registered_group(host):
    return EXTRACTOR(host).top_domain_under_public_suffix or host


def prepare(repo, category_csv, output, exclude_experiment=None):
    if output.exists():
        raise ValueError('Output exists; never overwrite a frozen experiment')
    rows, path_only_hosts = defaultdict(set), set()
    provenance, rejected = {}, Counter()
    reserved = set()
    for name in ('val', 'test'):
        path = repo / 'dataset/processed' / (name + '.csv')
        provenance[str(path.relative_to(repo))] = hashlib.sha256(path.read_bytes()).hexdigest()
        with path.open(encoding='utf-8-sig', newline='') as handle:
            for row in csv.DictReader(handle):
                try:
                    reserved.add(registered_group(hostname(row['url'])))
                except (ValueError, UnicodeError):
                    rejected['invalid_reserved_hostname'] += 1
    if exclude_experiment:
        for split in ('val', 'test'):
            path = exclude_experiment / (split + '.jsonl')
            provenance['excluded_experiment/' + path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
            for line in path.read_text(encoding='utf-8').splitlines():
                if line.strip():
                    row = json.loads(line)
                    reserved.add(registered_group(hostname(row['hostname'])))

    def add(url, category):
        try:
            host = hostname(url)
        except (ValueError, UnicodeError):
            rejected['invalid_or_ip'] += 1
            return
        if registered_group(host) in reserved:
            rejected['reserved_evaluation_domain'] += 1
            return
        parsed = urlsplit(url if '://' in url else 'https://' + url)
        if parsed.path not in ('', '/') or parsed.query or parsed.fragment:
            rejected['path_dependent_label'] += 1
            path_only_hosts.add(host)
            return
        rows[host].add(category)

    path = repo / 'dataset/processed/train.csv'
    provenance[str(path.relative_to(repo))] = hashlib.sha256(path.read_bytes()).hexdigest()
    with path.open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            category = row['label']
            if category not in ('benign', 'phishing', 'malware'):
                rejected['unsupported_repo_label'] += 1
                continue
            add(row['url'], category)
    provenance['labeled_data_final.csv'] = hashlib.sha256(category_csv.read_bytes()).hexdigest()
    # Label mapping confirmed by Daf. Label 3 (streaming) is not phishing.
    mapping = {'0': 'benign', '1': 'gambling', '2': 'adult'}
    with category_csv.open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            if row['label'] not in mapping:
                rejected['excluded_streaming_or_unknown_label'] += 1
                continue
            add(row['url'], mapping[row['label']])
    # A path-specific label supplies insufficient evidence for a hostname
    # category. Teach abstention, never project that label to the entire site.
    unknown_hosts = path_only_hosts - set(rows)
    for host in unknown_hosts:
        rows[host].add('unknown')
    splits = {name: [] for name in ('train', 'val', 'test')}
    groups = {name: set() for name in splits}
    inverse = {value: key for key, value in LABELS.items()}
    for host, categories in sorted(rows.items()):
        # Path-dependent or conflicting labels cannot establish domain safety.
        category = next(iter(categories)) if len(categories) == 1 else 'unknown'
        group = registered_group(host)
        bucket = int(hashlib.sha256(('afferent-llm-v2:' + group).encode()).hexdigest()[:8], 16) % 100
        split = 'train' if bucket < 80 else 'val' if bucket < 90 else 'test'
        splits[split].append({'hostname': host, 'group': group, 'label': inverse[category]})
        groups[split].add(group)
    overlaps = {f'{a}/{b}': len(groups[a] & groups[b]) for a, b in (('train', 'val'), ('train', 'test'), ('val', 'test'))}
    assert not any(overlaps.values()), overlaps
    rng = random.Random(42)
    # Bound the first experiment, retain benign support instead of training
    # on an artificial 50/50 mixture and then claiming real-world precision.
    caps = {'train': {'A': 2000, 'B': 700, 'C': 500, 'E': 600, 'F': 500, 'U': 200},
            'val': {'A': 400, 'B': 100, 'C': 100, 'E': 100, 'F': 100, 'U': 50},
            'test': {'A': 600, 'B': 150, 'C': 100, 'E': 150, 'F': 150, 'U': 60}}
    manifest = {'dataVersion': 2, 'seed': 42, 'featureScope': 'hostname_only', 'sourceSha256': provenance,
                'repoTrainingSplits': ['train'], 'reservedDomainGroups': len(reserved),
                'contractSha256': hashlib.sha256(SYSTEM.encode()).hexdigest(), 'advisoryOnly': True,
                'preparationScriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'registeredDomainOverlap': overlaps, 'excluded': dict(rejected),
                'unknownFromInsufficientUrlScope': len(unknown_hosts),
                'mixedHostnameLabels': sum(len(labels) > 1 for labels in rows.values()),
                'sourceLabelMap': {'0': 'benign', '1': 'gambling', '2': 'adult', '3': 'excluded_streaming'},
                'limitations': ['No TLS, path, HTML or image features', 'No temporal or real-traffic validation',
                    'Root URL labels are still source claims, not independent verification',
                    'Dataset sites may already occur in base-model pretraining; not auditable',
                    'Historical evaluation domains are excluded; no temporal or external validation'], 'counts': {},
                'artifactSha256': {}}
    for split, values in splits.items():
        selected = []
        for label, cap in caps[split].items():
            candidates = [row for row in values if row['label'] == label]
            rng.shuffle(candidates)
            selected.extend(candidates[:cap])
        rng.shuffle(selected)
        splits[split] = selected
        manifest['counts'][split] = dict(Counter(row['label'] for row in selected))
    manifest['trainingPreflightPassed'] = all(
        manifest['counts'][split].get('A', 0) >= (1 if split == 'train' else 400)
        and all(manifest['counts'][split].get(label, 0) >= (1 if split == 'train' else 30)
                for label in ('B', 'C', 'E', 'F'))
        for split in splits)
    output.mkdir(parents=True)
    for split, selected in splits.items():
        (output / (split + '.jsonl')).write_text(''.join(json.dumps(row) + '\n' for row in selected), encoding='utf-8')
        sft = [{'messages': messages(row['hostname']) + [{'role': 'assistant', 'content': row['label']}]}
               for row in selected]
        (output / (split + '.sft.jsonl')).write_text(''.join(json.dumps(row) + '\n' for row in sft), encoding='utf-8')
    (output / 'reserved_groups.json').write_text(json.dumps(sorted(reserved)) + '\n', encoding='utf-8')
    for name in ('train.jsonl', 'val.jsonl', 'test.jsonl', 'train.sft.jsonl', 'val.sft.jsonl', 'test.sft.jsonl', 'reserved_groups.json'):
        manifest['artifactSha256'][name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
    (output / 'dataset_manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=Path, default=Path('/work'))
    parser.add_argument('--category-csv', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--exclude-experiment', type=Path, help='Prior experiment whose validation/test domains must be excluded')
    args = parser.parse_args()
    prepare(args.repo, args.category_csv, args.output, args.exclude_experiment)
