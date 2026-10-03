// Run: node scripts/test-proxy-decision-ui.cjs (uses existing dashboard dependencies).
// Exercises UI handlers with in-memory hooks and mocked HTTP; no live policies change.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

async function check(kind, action) {
  const states = [], effects = [], timers = [], writes = [];
  let cursor = 0, firstRender = true, accepts = false;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: () => ({ current: null }),
    useEffect: callback => { if (firstRender) effects.push(callback); },
    useMemo: callback => callback(),
    useCallback: callback => callback,
  };
  const source = readFileSync(resolve(__dirname, '../src/components/admin/ProxyOperationsSection.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => name === 'react' ? hooks : name === './DomainSecondOpinion' ? { default: () => null } : require(name),
    window: { setTimeout: callback => { timers.push(callback); }, clearTimeout() {} },
    EventSource: class { addEventListener() {} close() {} },
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {
        writes.push({ url, body: JSON.parse(options.body) });
        return { ok: accepts, json: async () => accepts ? {} : { error: 'Policy rejected' } };
      }
      return { ok: true, json: async () => ({
        alerts: [{ id: 'alert-test', domain: 'alert.example.test', status: 'open', urgency: 'Critical', source: 'employee_report', created_at: '2026-10-03T00:00:00Z' }],
        verdicts: [], events: [{ event_id: 'traffic-test', domain: 'traffic.example.test', action: 'allow', method: 'CONNECT', decision_source: 'unknown', occurred_at: '2026-10-03T00:00:00Z' }],
      }) };
    },
  });
  function render() { cursor = 0; const tree = exports.default(); firstRender = false; return tree; }
  function nodes(tree) {
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    if (!tree || typeof tree !== 'object') return [];
    return [tree, ...nodes(tree.props?.children)];
  }
  function text(tree) {
    if (Array.isArray(tree)) return tree.map(text).join('');
    return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '');
  }
  render(); effects.forEach(effect => effect()); timers.forEach(timer => timer());
  await new Promise(resolve => setImmediate(resolve));
  const article = nodes(render()).find(node => node.type === 'article' && text(node).includes(`${kind}.example.test`));
  const button = nodes(article).find(node => node.type === 'button' && text(node).trim().toLowerCase() === action);
  assert.ok(button, 'decision button exists'); button.props.onClick();
  const dialog = () => nodes(render()).find(node => node.type === 'dialog');
  assert.ok(dialog(), 'click opens confirmation'); assert.equal(writes.length, 0, 'opening is read-only');
  const textarea = () => nodes(dialog()).find(node => node.type === 'textarea');
  const submit = () => nodes(dialog()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  textarea().props.onChange({ target: { value: '    ' } });
  await submit(); assert.equal(writes.length, 0, 'blank reason is rejected');
  textarea().props.onChange({ target: { value: '  Reviewed by SOC  ' } });
  await submit(); assert.ok(dialog(), 'API failure keeps the dialog open');
  assert.ok(text(dialog()).includes('Policy rejected'), 'API error is visible');
  accepts = true; await submit(); assert.equal(dialog(), undefined, 'success closes the dialog');
  const write = writes.at(-1);
  assert.equal(write.body.reason, 'Reviewed by SOC'); assert.equal(write.body.action, action);
  assert.equal(write.url, kind === 'alert' ? '/api/proxy/alerts/alert-test/decision' : '/api/proxy/manual-decision');
  if (kind === 'traffic') assert.equal(write.body.domain, 'traffic.example.test');
}

(async () => {
  await check('traffic', 'block'); await check('alert', 'block'); await check('alert', 'allow');
  console.log('PASS: confirmation, required reason, error retention, and Block/Allow payloads');
})().catch(error => { console.error(error); process.exitCode = 1; });
