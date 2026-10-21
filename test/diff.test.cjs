const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compare, inline, sequenceDiff } = require('../src/diff-engine.js');

test('empty, identical, insert, delete and replacement', () => {
  assert.equal(compare('', '').rows.length, 0);
  assert.equal(compare('你好\n🙂', '你好\n🙂').groups.length, 0);
  assert.equal(compare('', '新增').added, 1);
  assert.equal(compare('删除', '').removed, 1);
  const result = compare('a\nb\nc', 'a\nB\nc\nd');
  assert.deepEqual([result.modified, result.added, result.removed, result.groups.length], [1, 1, 0, 2]);
  assert.equal(result.rows[1].ln, 2);
});
test('normalization retains original content and trailing newline semantics', () => {
  const result = compare(' Hello \r\n世 界', 'hello\n世界', { whitespace: true, case: true });
  assert.equal(result.groups.length, 0); assert.equal(result.rows[0].left, ' Hello ');
  assert.equal(compare('a\r\nb', 'a\nb').groups.length, 0);
  assert.equal(compare('a\rb', 'a\nb').groups.length, 0);
  assert.equal(compare('a', 'a\n').added, 1);
  assert.equal(compare('a\n\nb', 'a\nb', { whitespace: true }).removed, 1);
  assert.equal(compare('Hello', 'hello').modified, 1);
});
test('inline Chinese, emoji and HTML-like strings preserve every character', () => {
  for (const [a, b] of [['你好🙂，世界', '你好🚀，新世界'], ['<script>你好</script>', '<b>您好</b>'], ['a'.repeat(6000), 'b'.repeat(6000)]]) {
    const parts = inline(a, b);
    assert.equal(parts[0].map(x => x.text).join(''), a);
    assert.equal(parts[1].map(x => x.text).join(''), b);
    assert.ok(parts[0].some(x => x.changed));
  }
});
test('inline highlights respect ignored whitespace and case within modified rows', () => {
  const parts = inline('He llo  A', 'hello B', { whitespace: true, case: true });
  assert.equal(parts[0].filter(x => x.changed).map(x => x.text).join(''), 'A');
  assert.equal(parts[1].filter(x => x.changed).map(x => x.text).join(''), 'B');
});
test('2000 deterministic random edit scripts reconstruct inputs and have minimal cost', () => {
  let seed = 83245;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let run = 0; run < 2000; run++) {
    const a = Array.from({ length: random(17) }, () => String(random(5)));
    const b = Array.from({ length: random(17) }, () => String(random(5)));
    const { ops, coarse } = sequenceDiff(a, b);
    assert.equal(coarse, false);
    assert.deepEqual(ops.filter(x => x.type !== 'insert').map(x => x.value), a);
    assert.deepEqual(ops.filter(x => x.type !== 'delete').map(x => x.value), b);
    const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    assert.equal(ops.filter(x => x.type !== 'equal').length, a.length + b.length - 2 * dp[a.length][b.length]);
  }
});
test('50000 lines, sparse edits and fully divergent bounded fallback', () => {
  const a = Array.from({ length: 50000 }, (_, i) => '原始行 ' + i), b = [...a];
  b[3] = '修改 3'; b[49995] = '修改 49995';
  const result = compare(a.join('\n'), b.join('\n'));
  assert.equal(result.modified, 2); assert.equal(result.coarse, false); assert.equal(result.rows.length, 50000);
  const divergent = compare(a.slice(0, 3000).join('\n'), a.slice(3000, 6000).join('\n'));
  assert.equal(divergent.coarse, true);
  assert.deepEqual(divergent.rows.filter(x => x.left !== null).map(x => x.left), a.slice(0, 3000));
  assert.deepEqual(divergent.rows.filter(x => x.right !== null).map(x => x.right), a.slice(3000, 6000));
});
