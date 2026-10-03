"""Bounded QLoRA experiment, base/candidate comparison and CPU merge export.

No claim of calibrated confidence or automatic blocking eligibility is made.
Candidate selection uses validation only; the frozen test is checked once.
"""
import argparse
import gc
import hashlib
import json
import math
import random
import time
from collections import Counter
from pathlib import Path
from importlib.metadata import version

import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, PeftModel

from contract import LABELS, SYSTEM, messages
from dataset_guard import read_rows, validate_dataset


def prompt(tokenizer, host):
    return tokenizer.apply_chat_template(messages(host), tokenize=True,
        add_generation_prompt=True, enable_thinking=False)


def pad(rows, tokenizer, device):
    maximum = max(len(row) for row in rows)
    ids = torch.tensor([row + [tokenizer.pad_token_id] * (maximum - len(row)) for row in rows], device=device)
    mask = torch.tensor([[1] * len(row) + [0] * (maximum - len(row)) for row in rows], device=device)
    return ids, mask


def metrics(rows, predictions):
    if not rows or len(rows) != len(predictions):
        raise ValueError('Evaluation needs one prediction per sample')
    confusion = Counter((row['label'], prediction) for row, prediction in zip(rows, predictions))
    f1, categories = [], {}
    for label, name in LABELS.items():
        support = sum(row['label'] == label for row in rows)
        tp = confusion[(label, label)]
        fp = sum(n for (actual, predicted), n in confusion.items() if predicted == label and actual != label)
        fn = support - tp
        score = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0
        if support:
            f1.append(score)
        categories[name] = {'support': support, 'recall': tp / support if support else None, 'f1': score}
    benign = sum(row['label'] == 'A' for row in rows)
    false_flags = sum(n for (actual, prediction), n in confusion.items() if actual == 'A' and prediction not in ('A', 'U'))
    if benign:
        rate, z = false_flags / benign, 1.96
        divisor = 1 + z * z / benign
        center = (rate + z * z / (2 * benign)) / divisor
        spread = z * math.sqrt(rate * (1 - rate) / benign + z * z / (4 * benign * benign)) / divisor
        interval = [max(0, center - spread), min(1, center + spread)]
    else:
        interval = None
    return {'samples': len(rows), 'accuracy': sum(row['label'] == prediction for row, prediction in zip(rows, predictions)) / len(rows),
        'macroF1': sum(f1) / len(f1), 'benignSamples': benign, 'benignFalseFlags': false_flags,
        'benignFalseFlagRate': false_flags / benign if benign else None,
        'benignFalseFlag95CI': interval,
        'benignUnknownFraction': confusion[('A', 'U')] / benign if benign else None,
        'unknownFraction': predictions.count('U') / len(predictions), 'categories': categories,
        'confusion': {actual + '->' + prediction: n for (actual, prediction), n in sorted(confusion.items())}}


def quality_gate(result):
    return (result['benignSamples'] >= 400 and result['macroF1'] >= .6
        and result['benignFalseFlagRate'] <= .01
        and result['benignFalseFlag95CI'] is not None and result['benignFalseFlag95CI'][1] <= .01
        and all(result['categories'][category]['support'] >= 30
                and result['categories'][category]['recall'] is not None
                and result['categories'][category]['recall'] >= .5
                for category in ('phishing', 'malware', 'gambling', 'adult')))


@torch.inference_mode()
def evaluate(model, tokenizer, rows, batch_size=8):
    model.eval()
    tokens = {label: tokenizer.encode(label, add_special_tokens=False)[0] for label in LABELS}
    assert all(len(tokenizer.encode(label, add_special_tokens=False)) == 1 for label in LABELS)
    inverse = {value: label for label, value in tokens.items()}
    predictions = []
    for start in range(0, len(rows), batch_size):
        encoded = [prompt(tokenizer, row['hostname']) for row in rows[start:start + batch_size]]
        ids, mask = pad(encoded, tokenizer, model.device)
        output = model(input_ids=ids, attention_mask=mask, use_cache=False)
        logits = output.logits[torch.arange(len(encoded), device=model.device), [len(row) - 1 for row in encoded]]
        # Invalid generated first tokens are abstentions, never forced labels.
        predictions.extend(inverse.get(int(token), 'U') for token in logits.argmax(-1).tolist())
    return metrics(rows, predictions)


def train(args):
    splits, manifest = validate_dataset(args.dataset)
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA GPU required for this bounded QLoRA run')
    if args.output.exists():
        raise ValueError('Candidate output exists; do not overwrite an experiment')
    torch.manual_seed(42)
    random.seed(42)
    torch.cuda.reset_peak_memory_stats()
    started = time.monotonic()
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4',
        bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=dtype)
    tokenizer = AutoTokenizer.from_pretrained(args.model, revision=args.revision, trust_remote_code=False)
    tokenizer.pad_token = tokenizer.eos_token
    base = AutoModelForCausalLM.from_pretrained(args.model, revision=args.revision,
        quantization_config=config, device_map={'': 0}, dtype=dtype, trust_remote_code=False,
        attn_implementation='sdpa')
    train_rows, val_rows, test_rows = [splits[split] for split in ('train', 'val', 'test')]
    report = {'baseModel': args.model, 'revision': getattr(base.config, '_commit_hash', args.revision),
        'device': torch.cuda.get_device_name(), 'featureScope': 'hostname_only',
        'quantizationTraining': 'NF4 double quantization', 'adapter': {'rank': 8, 'alpha': 16},
        'trainSamples': len(train_rows), 'maxSteps': args.steps, 'effectiveBatch': args.batch * args.accumulation,
        'contractSha256': hashlib.sha256(SYSTEM.encode()).hexdigest(), 'labelMap': LABELS,
        'trainingScriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'datasetManifestSha256': hashlib.sha256((args.dataset / 'dataset_manifest.json').read_bytes()).hexdigest(),
        'dataVersion': manifest['dataVersion'], 'historicalEvaluationDomainsExcluded': True,
        'packages': {name: version(name) for name in ('torch', 'transformers', 'peft', 'bitsandbytes')},
        'datasetSha256': {split: hashlib.sha256((args.dataset / (split + '.jsonl')).read_bytes()).hexdigest() for split in ('train', 'val', 'test')},
        'advisoryOnly': True}
    print('Evaluating base validation', flush=True)
    report['baseValidation'] = evaluate(base, tokenizer, val_rows)
    base = prepare_model_for_kbit_training(base, use_gradient_checkpointing=True)
    model = get_peft_model(base, LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05,
        bias='none', task_type='CAUSAL_LM', target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj']))
    model.config.use_cache = False
    model.train()
    model.print_trainable_parameters()
    encoded = []
    for row in train_rows:
        prefix = prompt(tokenizer, row['hostname'])
        target = tokenizer.encode(row['label'], add_special_tokens=False) + [tokenizer.eos_token_id]
        if len(prefix) + len(target) > 256:
            raise ValueError('Prompt exceeded bounded sequence length; do not silently truncate domains')
        encoded.append((prefix + target, [-100] * len(prefix) + target))

    def collate(batch):
        ids, masks = pad([row[0] for row in batch], tokenizer, model.device)
        length = ids.shape[1]
        labels = torch.tensor([row[1] + [-100] * (length - len(row[1])) for row in batch], device=model.device)
        return {'input_ids': ids, 'attention_mask': masks, 'labels': labels}

    loader = DataLoader(encoded, batch_size=args.batch, shuffle=True, collate_fn=collate, num_workers=0)
    optimizer = torch.optim.AdamW([parameter for parameter in model.parameters() if parameter.requires_grad], lr=2e-4)
    optimizer.zero_grad(set_to_none=True)
    micro, step, losses = 0, 0, []
    training_started = time.monotonic()
    while step < args.steps:
        for batch in loader:
            with torch.autocast('cuda', dtype=dtype):
                loss = model(**batch).loss
            if not torch.isfinite(loss):
                raise ValueError('Non-finite training loss')
            (loss / args.accumulation).backward()
            losses.append(float(loss.detach()))
            micro += 1
            if micro % args.accumulation:
                continue
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            learning_rate = 2e-4 * min(1, (step + 1) / 10) * (0.1 + 0.9 * (1 + math.cos(math.pi * step / args.steps)) / 2)
            for group in optimizer.param_groups:
                group['lr'] = learning_rate
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
            step += 1
            if step == 1 or step % 10 == 0:
                print(json.dumps({'step': step, 'loss': sum(losses[-args.accumulation:]) / args.accumulation,
                    'elapsedSeconds': round(time.monotonic() - started), 'peakVramMiB': round(torch.cuda.max_memory_allocated() / 1024 ** 2)}), flush=True)
            if step >= args.steps or time.monotonic() - training_started >= args.minutes * 60:
                break
        if time.monotonic() - training_started >= args.minutes * 60:
            break
    report['actualSteps'] = step
    report['trainingSeconds'] = round(time.monotonic() - training_started)
    model.config.use_cache = True
    print('Evaluating candidate validation', flush=True)
    report['candidateValidation'] = evaluate(model, tokenizer, val_rows)
    # One frozen test pass, never use test examples in training or selection.
    print('Evaluating frozen candidate test', flush=True)
    report['candidateTest'] = evaluate(model, tokenizer, test_rows)
    candidate = report['candidateValidation']
    report['qualityGate'] = {'minBenignSupport': 400, 'minThreatClassSupport': 30,
        'minMacroF1': .6, 'minRecallEachThreatClass': .5, 'maxBenignFalseFlagRate': .01,
        'maxBenignFalseFlag95UpperBound': .01}
    report['validationGatePassed'] = quality_gate(candidate) and candidate['macroF1'] > report['baseValidation']['macroF1']
    report['holdoutGatePassed'] = quality_gate(report['candidateTest'])
    report['automaticEnforcementEligible'] = False
    report['peakVramMiB'] = round(torch.cuda.max_memory_allocated() / 1024 ** 2)
    report['elapsedSeconds'] = round(time.monotonic() - started)
    report['limitations'] = ['Internal holdout, not real-world or temporal generalization',
        'No calibrated model confidence; internal Wilson bounds do not guarantee real-world false-flag rates',
        'No category verification by browsing; hostname evidence is incomplete',
        'Quantized Ollama runtime requires a separate equivalence/latency check']
    args.output.mkdir(parents=True)
    adapter = args.output / 'adapter'
    model.save_pretrained(adapter)
    tokenizer.save_pretrained(adapter)
    (args.output / 'evaluation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)
    del optimizer, model, base
    gc.collect()
    torch.cuda.empty_cache()
    # Merge into the original full-precision CPU model, not quantized weights.
    print('Exporting merged safetensors on CPU', flush=True)
    original = AutoModelForCausalLM.from_pretrained(args.model, revision=report['revision'],
        dtype=torch.float16, device_map={'': 'cpu'}, trust_remote_code=False, low_cpu_mem_usage=True)
    merged = PeftModel.from_pretrained(original, adapter).merge_and_unload()
    destination = args.output / 'merged'
    merged.save_pretrained(destination, safe_serialization=True, max_shard_size='1GB')
    tokenizer.save_pretrained(destination)
    print('Candidate exported; not automatically activated', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--model', default='Qwen/Qwen3-0.6B')
    parser.add_argument('--revision', required=True)
    parser.add_argument('--steps', type=int, default=300)
    parser.add_argument('--batch', type=int, default=4)
    parser.add_argument('--accumulation', type=int, default=8)
    parser.add_argument('--minutes', type=int, default=15)
    args = parser.parse_args()
    if not 1 <= args.steps <= 600 or not 1 <= args.batch <= 4 or not 1 <= args.accumulation <= 32 or not 1 <= args.minutes <= 30:
        raise ValueError('Training exceeds bounded demo budget')
    train(args)
