"""Frozen holdout check and latency measurement of the imported INT4 candidate.

Never visits corpus websites or writes an AFFERENT policy. Run in the training
image on the private Compose network, not against a publicly exposed Ollama.
"""
import argparse
import hashlib
import json
import statistics
import time
from pathlib import Path

import requests

from contract import LABELS, SYSTEM, messages
from train import metrics, quality_gate, read_rows


def classify(base, model, hostname):
    started = time.monotonic()
    response = requests.post(base + '/api/chat', json={'model': model,
        'messages': messages(hostname), 'think': False, 'stream': False,
        'keep_alive': '10m', 'options': {'temperature': 0, 'num_ctx': 512, 'num_predict': 2}},
        timeout=(3, 90), allow_redirects=False)
    response.raise_for_status()
    output = response.json()
    token = output['message']['content'].strip()
    return token if token in LABELS else 'U', round((time.monotonic() - started) * 1000, 2), output


def check(args):
    if args.output.exists():
        raise ValueError('Runtime evaluation already exists; do not overwrite evidence')
    evaluation = json.loads((args.candidate / 'evaluation.json').read_text())
    if hashlib.sha256(SYSTEM.encode()).hexdigest() != evaluation['contractSha256']:
        raise ValueError('Training/runtime prompt mismatch')
    test_path = args.dataset / 'test.jsonl'
    if hashlib.sha256(test_path.read_bytes()).hexdigest() != evaluation['datasetSha256']['test']:
        raise ValueError('Frozen test checksum mismatch')
    # Explicit unload before measuring cold start. This is not a latency test
    # of the Flask job queue or its five-second dashboard refresh interval.
    response = requests.post(args.base + '/api/generate', json={'model': args.model, 'keep_alive': 0}, timeout=(3, 90))
    response.raise_for_status()
    _, cold_ms, cold = classify(args.base, args.model, 'example.com')
    rows, predictions, latency = read_rows(test_path), [], []
    for index, row in enumerate(rows):
        label, elapsed, _ = classify(args.base, args.model, row['hostname'])
        predictions.append(label)
        latency.append(elapsed)
        if (index + 1) % 100 == 0:
            print(json.dumps({'evaluated': index + 1, 'warmMedianMs': statistics.median(latency)}), flush=True)
    ordered = sorted(latency)
    result = metrics(rows, predictions)
    report = {'model': args.model, 'quantization': 'Ollama INT4', 'featureScope': 'hostname_only',
        'frozenTestSha256': evaluation['datasetSha256']['test'], 'runtimeTest': result,
        'latency': {'coldMs': cold_ms, 'coldLoadMs': cold.get('load_duration', 0) / 1e6,
                    'warmP50Ms': statistics.median(latency), 'warmP95Ms': ordered[int((len(ordered) - 1) * .95)],
                    'samples': len(rows), 'scope': 'Ollama HTTP classification, excludes queue/UI refresh'},
        'gatePassed': evaluation['validationGatePassed'] and evaluation['holdoutGatePassed']
            and quality_gate(result)
            and result['macroF1'] >= evaluation['candidateTest']['macroF1'] - .02
            and ordered[int((len(ordered) - 1) * .95)] <= 250,
        'automaticEnforcementEligible': False, 'advisoryOnly': True,
        'limitations': evaluation['limitations']}
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://local_llm:11434')
    parser.add_argument('--model', default='afferent-hostname-06b:v1')
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    check(parser.parse_args())
