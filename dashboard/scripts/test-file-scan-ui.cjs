// In-memory UI contract: no browser, live employee, file upload or VT request.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const states = [], deps = [], cleanup = [], effects = [], timers = new Map(), writes = [];
let cursor = 0, effectCursor = 0, timerId = 0, rewards = 0;
let result = { id: 'owned-scan', file_name: 'fixture.exe', file_size: 10, created_at: '2026-10-03',
  status: 'pending', verdict: 'unknown', analysis: { verdict: 'unknown' } };
const hooks = {
  useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  },
  useRef: () => ({ current: { value: '' } }),
  useEffect(callback, next) {
    const index = effectCursor++;
    if (!deps[index] || next.some((value, i) => !Object.is(value, deps[index][i]))) {
      deps[index] = next;
      effects.push(() => { cleanup[index]?.(); cleanup[index] = callback(); });
    }
  },
};
const exportsFixture = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/EmployeeUrlScanner.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: exportsFixture, File, FormData, AbortController,
  require: name => name === 'react' ? hooks : name === './ThreatEvidence' ? { default: () => null } : require(name),
  window: { setInterval: callback => { timers.set(++timerId, callback); return timerId; }, clearInterval: id => timers.delete(id) },
  fetch: async (url, options = {}) => {
    if (options.method === 'POST') {
      writes.push({ url, body: options.body });
      return { ok: true, json: async () => ({ scan: result }) };
    }
    return { ok: true, json: async () => url === '/api/reports' ? { reports: [] }
      : { scans: writes.length ? [result] : [], maxBytes: 10 * 1024 * 1024 } };
  },
});
function render() { cursor = effectCursor = 0; return exportsFixture.default({ onReportComplete: () => rewards++ }); }
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '');
}
function find(type, predicate = () => true) { return nodes(render()).find(node => node.type === type && predicate(node)); }
function flush() { effects.splice(0).forEach(callback => callback()); }
const settle = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  render(); flush(); await settle();
  find('button', node => text(node) === 'Scan file').props.onClick();
  const input = find('input', node => node.props.type === 'file');
  assert.equal(input.props.accept, undefined, 'formats are not restricted to PDF');
  input.props.onChange({ target: { files: [new File(['MZ fixture'], 'fixture.exe')] } });
  await find('form').props.onSubmit({ preventDefault() {} });
  assert.equal(writes.length, 0, 'sharing consent is mandatory');
  find('input', node => node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  await find('form').props.onSubmit({ preventDefault() {} });
  assert.equal(writes[0].url, '/api/threat/file-scan');
  assert.equal(writes[0].body.get('file').name, 'fixture.exe');
  assert.equal(writes[0].body.get('consent'), 'true');
  assert.equal(writes[0].body.has('description'), false);
  assert.equal(rewards, 0, 'file checks do not trigger report scoring');
  render(); flush();
  assert.equal(timers.size, 1, 'pending scans refresh automatically');
  find('button', node => text(node) === 'Scan URL').props.onClick();
  result = { ...result, status: 'completed', verdict: 'malicious', analysis: { verdict: 'malicious' } };
  await [...timers.values()][0]();
  const alert = nodes(render()).find(node => node.props?.className === 'file-scan-result');
  assert.equal(alert.props.role, 'alert');
  assert.ok(text(alert).includes('Threat detected'));
  assert.ok(text(alert).includes('Do not open or run it.'));
  assert.equal(alert.props.role, 'alert', 'a threat remains visible after switching tool tabs');
  flush(); assert.equal(timers.size, 0, 'completed jobs stop polling');
  find('button', node => text(node) === 'Scan file').props.onClick();
  for (const verdict of ['clean', 'unknown']) {
    result = { ...result, verdict, status: verdict === 'unknown' ? 'unknown' : 'completed' };
    await find('button', node => text(node) === 'Refresh').props.onClick();
    await settle();
    const card = nodes(render()).find(node => node.props?.className === 'file-scan-result');
    assert.equal(card.props.role, 'status');
    assert.ok(text(card).includes(verdict === 'clean' ? 'not a guarantee of safety' : 'Do not treat this file as safe'));
  }
  assert.equal(writes.length, 1); assert.equal(rewards, 0);
  assert.ok(!text(render()).includes('Awaiting SOC review'));
  console.log('PASS: private file upload, consent, non-PDF support, automatic threat alert, stopped polling and honest clean/Unknown labels');
})().catch(error => { console.error(error); process.exitCode = 1; });
