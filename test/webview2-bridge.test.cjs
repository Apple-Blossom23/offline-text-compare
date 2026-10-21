const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../webview2/bridge.js'), 'utf8');
function bridge(url = 'https://textcompare.invalid/index.html', iframe = false) {
  const handlers = {}, sent = [];
  const window = { chrome: { webview: { addEventListener: (name, callback) => handlers[name] = callback, postMessage: message => sent.push(message) } } };
  window.top = iframe ? {} : window;
  vm.runInNewContext(source, { window, chrome: window.chrome, location: { href: url }, Map, Set });
  return { api: window.textCompareDesktop, handlers, sent };
}
test('WebView2 bridge is restricted to the main local app document', () => {
  assert.equal(bridge('https://example.com').api, undefined);
  assert.equal(bridge(undefined, true).api, undefined);
});
test('save replies correlate by id and report cancellation or failure', async () => {
  const b = bridge();
  const saved = b.api.saveReport('<!doctype html>', 'report.html');
  const canceled = b.api.saveReport('<!doctype html>', 'report.html');
  b.handlers.message({ data: { type: 'reply', id: b.sent[1].id, canceled: true } });
  b.handlers.message({ data: { type: 'reply', id: b.sent[0].id, canceled: false } });
  assert.equal((await saved).canceled, false); assert.equal((await canceled).canceled, true);
  const error = b.api.saveReport('bad', 'a.html');
  b.handlers.message({ data: { type: 'reply', id: b.sent[2].id, error: 'denied' } });
  await assert.rejects(error, /denied/);
});
test('only the supported desktop menu actions are delivered', () => {
  const b = bridge(), calls = []; b.api.onAction(name => calls.push(name));
  b.handlers.message({ data: { type: 'action', name: 'run-shell' } });
  b.handlers.message({ data: { type: 'action', name: 'help' } });
  assert.deepEqual(calls, ['help']);
});
test('native file picker transports bytes without accepting a file path from the page', async () => {
  const b = bridge();
  const file = b.api.openFile();
  assert.deepEqual(Object.keys(b.sent[0]).sort(), ['id', 'type']);
  assert.equal(b.sent[0].type, 'open-file');
  b.handlers.message({ data: { type: 'reply', id: b.sent[0].id, filename: '中文.txt', base64: '5Lit5paH', canceled: false } });
  const imported = await file;
  assert.equal(imported.filename, '中文.txt'); assert.equal(Buffer.from(imported.base64, 'base64').toString(), '中文');
});
