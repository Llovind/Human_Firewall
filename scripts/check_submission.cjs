// Read-only guard for the files Git would publish. Never prints secret values.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const staged = process.argv.includes('--staged');
const args = staged
  ? ['ls-files', '-z']
  : ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
const files = [...new Set(execFileSync('git', args, { cwd: root }).toString().split('\0').filter(Boolean))];
const secrets = [];
for (const name of ['.env', '.env.proxy.local']) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PEPPER)[A-Z_]*)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    if (value.length >= 12 && !value.startsWith('replace-with-')) secrets.push(value);
  }
}
const blocked = /(^|\/)(?:\.env(?:\..*)?|secrets|node_modules|\.next|__pycache__|\.cache|Skill MD|investor-materials)(\/|$)|\.(?:key|pfx|p12|db|sqlite|pyc|tsbuildinfo)$/i;
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['provider token', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AIza[\w-]{35}|xox[baprs]-[\w-]{20,}|\d{8,12}:[A-Za-z0-9_-]{35})/],
  ['model/provider token', /(?<![A-Za-z0-9_/.-])(?:sk-(?:or-v1-)?[A-Za-z0-9_-]{40,}|gsk_[A-Za-z0-9]{40,}|hf_[A-Za-z0-9]{30,}|fc-[A-Za-z0-9_-]{32,})\b/],
];
let failures = 0;
let total = 0;
for (const name of files) {
  const file = path.join(root, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  total++;
  const issues = [];
  if (name !== '.env.example' && blocked.test(name)) issues.push('private/generated/tooling path');
  const bytes = staged
    ? execFileSync('git', ['show', `:${name}`], { cwd: root, maxBuffer: 110 * 1024 * 1024 })
    : fs.readFileSync(file);
  if (bytes.length >= 100 * 1024 * 1024) issues.push('exceeds GitHub file limit');
  const content = bytes.toString('utf8');
  if (secrets.some(value => content.includes(value))) issues.push('matches a local credential');
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) issues.push(label);
  }
  // The raw security corpus contains malicious sample URLs with AWS identifiers.
  // Preserve its provenance; no live keys belong in source/config/documentation.
  if (!name.startsWith('dataset/') && /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(content)) issues.push('cloud access key');
  if (issues.length) {
    console.error(`${name}: ${issues.join(', ')}`);
    failures++;
  }
}
console.log(`Submission guard: ${total} files checked; ${failures} files require attention.`);
console.log('This bounded guard is not a full secret-history or vulnerability audit.');
process.exitCode = failures ? 1 : 0;
