"""Validate offline evidence before any model download or GPU allocation."""
import hashlib
import json
from collections import Counter

from contract import LABELS, SYSTEM, messages
from prepare import hostname, registered_group


def read_rows(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def validate_dataset(path):
    manifest = json.loads((path / 'dataset_manifest.json').read_text(encoding='utf-8'))
    if (manifest.get('dataVersion') != 2 or manifest.get('repoTrainingSplits') != ['train']
            or manifest.get('advisoryOnly') is not True or manifest.get('featureScope') != 'hostname_only'
            or manifest.get('contractSha256') != hashlib.sha256(SYSTEM.encode()).hexdigest()):
        raise ValueError('Dataset protocol or training/runtime contract mismatch')
    names = ('train.jsonl', 'val.jsonl', 'test.jsonl', 'train.sft.jsonl', 'val.sft.jsonl', 'test.sft.jsonl', 'reserved_groups.json')
    for name in names:
        if manifest.get('artifactSha256', {}).get(name) != hashlib.sha256((path / name).read_bytes()).hexdigest():
            raise ValueError('Dataset checksum mismatch: ' + name)
    reserved = set(json.loads((path / 'reserved_groups.json').read_text(encoding='utf-8')))
    if len(reserved) != manifest.get('reservedDomainGroups'):
        raise ValueError('Reserved domain count mismatch')
    splits, seen_hosts, seen_groups = {}, set(), set()
    for split in ('train', 'val', 'test'):
        rows, sft = read_rows(path / (split + '.jsonl')), read_rows(path / (split + '.sft.jsonl'))
        if not rows or len(rows) != len(sft):
            raise ValueError('Empty or inconsistent training data')
        groups = set()
        for row, target in zip(rows, sft):
            if (set(row) != {'hostname', 'group', 'label'} or row['label'] not in LABELS
                    or row['hostname'] != hostname(row['hostname'])
                    or row['group'] != registered_group(row['hostname'])):
                raise ValueError('Invalid hostname-only example')
            if row['hostname'] in seen_hosts or row['group'] in reserved:
                raise ValueError('Duplicate hostname or reserved evaluation domain')
            seen_hosts.add(row['hostname'])
            groups.add(row['group'])
            expected = {'messages': messages(row['hostname']) + [{'role': 'assistant', 'content': row['label']}]}
            if target != expected:
                raise ValueError('SFT prompt/target mismatch; scores and generated reasons are not targets')
        if groups & seen_groups:
            raise ValueError('Registered-domain leakage between splits')
        seen_groups.update(groups)
        counts = dict(Counter(row['label'] for row in rows))
        if counts != manifest.get('counts', {}).get(split):
            raise ValueError('Dataset label counts mismatch')
        if counts.get('A', 0) < (1 if split == 'train' else 400) or any(
                counts.get(label, 0) < (1 if split == 'train' else 30) for label in ('B', 'C', 'E', 'F')):
            raise ValueError('Insufficient class support; need >=400 benign and >=30 per threat class in each holdout')
        splits[split] = rows
    if manifest.get('trainingPreflightPassed') is not True:
        raise ValueError('Dataset preparation did not pass preflight')
    return splits, manifest
