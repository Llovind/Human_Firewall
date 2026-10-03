"""Offline preparation/preflight checks; no model download or network access."""
import csv
import hashlib
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from contract import LABELS, messages
from dataset_guard import read_rows, validate_dataset
from prepare import hostname, prepare


def write_csv(path, rows):
    with path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['url', 'label'])
        writer.writeheader()
        writer.writerows(rows)


class PreparationTest(unittest.TestCase):
    def test_hostname_boundary(self):
        self.assertEqual(hostname('HTTPS://BÜCHER-DEMO.DE/'), 'xn--bcher-demo-9db.de')
        for invalid in ('ftp://example.com', 'http://127.0.0.1/', 'https://user:pass@example.com',
                'https://example.com:abc', 'https://ex\tample.com', '.example.com', 'localhost'):
            with self.subTest(invalid=invalid), self.assertRaises((ValueError, UnicodeError)):
                hostname(invalid)

    def test_prepared_data_is_offline_reproducible_and_guarded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            processed, prior = root / 'dataset/processed', root / 'prior'
            processed.mkdir(parents=True)
            prior.mkdir()
            train = [{'url': f'https://benign-fixture-{i}.com/', 'label': 'benign'} for i in range(5000)]
            for category in ('phishing', 'malware'):
                train.extend({'url': f'https://{category}-fixture-{i}.com/', 'label': category} for i in range(1500))
            train.extend([{'url': 'https://original-heldout.org/', 'label': 'phishing'},
                {'url': 'https://previous-heldout.net/', 'label': 'malware'},
                {'url': 'https://path-only-example.org/signin?token=test', 'label': 'phishing'},
                {'url': 'https://shared-demo.org/', 'label': 'benign'},
                {'url': 'https://shared-demo.org/malware', 'label': 'malware'},
                {'url': 'https://conflicting-demo.org/', 'label': 'benign'},
                {'url': 'https://conflicting-demo.org/', 'label': 'malware'}])
            write_csv(processed / 'train.csv', train)
            for split in ('val', 'test'):
                write_csv(processed / (split + '.csv'), [{'url': 'https://sub.original-heldout.org/private', 'label': 'malware'}])
                (prior / (split + '.jsonl')).write_text(json.dumps({'hostname': 'sub.previous-heldout.net',
                    'group': 'previous-heldout.net', 'label': 'B'}) + '\n', encoding='utf-8')
            categories = root / 'categories.csv'
            rows = [{'url': f'https://{category}-fixture-{i}.com/', 'label': label}
                for category, label in (('gambling', '1'), ('adult', '2')) for i in range(1500)]
            rows.append({'url': 'https://streaming-only-demo.org/', 'label': '3'})
            write_csv(categories, rows)
            output = root / 'prepared'
            with redirect_stdout(io.StringIO()):
                prepare(root, categories, output, prior)
            splits, manifest = validate_dataset(output)
            hosts = {row['hostname'] for values in splits.values() for row in values}
            self.assertFalse(hosts & {'original-heldout.org', 'previous-heldout.net',
                'streaming-only-demo.org'})
            labels = {row['hostname']: row['label'] for values in splits.values() for row in values}
            self.assertEqual(labels['path-only-example.org'], 'U')
            self.assertEqual(labels['shared-demo.org'], 'A')
            self.assertEqual(manifest['repoTrainingSplits'], ['train'])
            self.assertEqual(manifest['excluded']['reserved_evaluation_domain'], 2)
            self.assertEqual(manifest['excluded']['path_dependent_label'], 2)
            self.assertEqual(manifest['mixedHostnameLabels'], 1)
            self.assertEqual(manifest['excluded']['excluded_streaming_or_unknown_label'], 1)
            self.assertTrue(all(target['messages'][-1]['content'] in LABELS
                for split in splits for target in read_rows(output / (split + '.sft.jsonl'))))
            duplicate = root / 'prepared-again'
            with redirect_stdout(io.StringIO()):
                prepare(root, categories, duplicate, prior)
            self.assertEqual(manifest['artifactSha256'], json.loads((duplicate / 'dataset_manifest.json').read_text())['artifactSha256'])
            with self.assertRaises(ValueError):
                prepare(root, categories, output, prior)

            test_path = output / 'test.jsonl'
            original_bytes = test_path.read_bytes()
            test_path.write_bytes(original_bytes + b'\n')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                validate_dataset(output)
            test_path.write_bytes(original_bytes)

            # Even self-consistent file hashes must not disguise split leakage.
            train_row = next(row for row in splits['train'] if row['label'] == 'A')
            val_index = next(index for index, row in enumerate(splits['val']) if row['label'] == 'A')
            rows = splits['val']
            rows[val_index] = train_row
            (output / 'val.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in rows), encoding='utf-8')
            manifest['artifactSha256']['val.jsonl'] = hashlib.sha256((output / 'val.jsonl').read_bytes()).hexdigest()
            (output / 'dataset_manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate hostname'):
                validate_dataset(output)

            rows[val_index] = {**train_row, 'hostname': 'sub.' + train_row['hostname']}
            targets = [{'messages': messages(row['hostname']) + [{'role': 'assistant', 'content': row['label']}]}
                       for row in rows]
            (output / 'val.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in rows), encoding='utf-8')
            (output / 'val.sft.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in targets), encoding='utf-8')
            for name in ('val.jsonl', 'val.sft.jsonl'):
                manifest['artifactSha256'][name] = hashlib.sha256((output / name).read_bytes()).hexdigest()
            (output / 'dataset_manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Registered-domain leakage'):
                validate_dataset(output)

    def test_small_dataset_is_not_silently_trainable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            processed = root / 'dataset/processed'
            processed.mkdir(parents=True)
            for split in ('train', 'val', 'test'):
                write_csv(processed / (split + '.csv'), [])
            categories = root / 'categories.csv'
            write_csv(categories, [{'url': 'https://fixture-benign.org/', 'label': '0'}])
            output = root / 'prepared'
            with redirect_stdout(io.StringIO()):
                prepare(root, categories, output)
            self.assertFalse(json.loads((output / 'dataset_manifest.json').read_text())['trainingPreflightPassed'])
            with self.assertRaises(ValueError):
                validate_dataset(output)


if __name__ == '__main__':
    unittest.main()
