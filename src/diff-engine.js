/* Shared by the offline Web Worker and Node regression tests. No dependencies. */
(function (root) {
  'use strict';
  function sequenceDiff(a, b, budget = 3000000) {
    let head = 0, tail = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;
    while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
    const left = a.slice(head, a.length - tail), right = b.slice(head, b.length - tail);
    const before = a.slice(0, head).map(value => ({ type: 'equal', value }));
    const after = a.slice(a.length - tail).map(value => ({ type: 'equal', value }));
    if (!left.length || !right.length) return { ops: before.concat(left.map(value => ({ type: 'delete', value })), right.map(value => ({ type: 'insert', value })), after), coarse: false };
    const n = left.length, m = right.length, trace = [];
    let v = new Map([[1, 0]]), work = 0;
    for (let d = 0; d <= n + m; d++) {
      if ((work += 2 * d + 1) > budget || d > 1400) break;
      trace.push(new Map(v));
      for (let k = -d; k <= d; k += 2) {
        const down = k === -d || (k !== d && (v.get(k - 1) ?? -Infinity) < (v.get(k + 1) ?? -Infinity));
        let x = down ? (v.get(k + 1) ?? 0) : (v.get(k - 1) ?? 0) + 1;
        let y = x - k;
        while (x < n && y < m && left[x] === right[y]) { x++; y++; }
        v.set(k, x);
        if (x >= n && y >= m) {
          const reversed = [];
          for (let depth = d; depth >= 0; depth--) {
            const previous = trace[depth], diagonal = x - y;
            const prevK = diagonal === -depth || (diagonal !== depth && (previous.get(diagonal - 1) ?? -Infinity) < (previous.get(diagonal + 1) ?? -Infinity)) ? diagonal + 1 : diagonal - 1;
            const prevX = previous.get(prevK) ?? 0, prevY = prevX - prevK;
            while (x > prevX && y > prevY) { reversed.push({ type: 'equal', value: left[x - 1] }); x--; y--; }
            if (!depth) break;
            if (x === prevX) { reversed.push({ type: 'insert', value: right[y - 1] }); y--; }
            else { reversed.push({ type: 'delete', value: left[x - 1] }); x--; }
          }
          return { ops: before.concat(reversed.reverse(), after), coarse: false };
        }
      }
    }
    // Bounded fallback: retain every input line and clearly report the coarser alignment.
    return { ops: before.concat(left.map(value => ({ type: 'delete', value })), right.map(value => ({ type: 'insert', value })), after), coarse: true };
  }
  function lines(text) { return text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n'); }
  function compare(leftText, rightText, options = {}) {
    const left = lines(leftText), right = lines(rightText);
    const normalize = line => {
      if (options.whitespace) line = line.replace(/\s+/gu, '');
      if (options.case) line = line.toLowerCase();
      return line;
    };
    const a = left.map(normalize), b = right.map(normalize);
    const result = sequenceDiff(a, b);
    const rows = [], groups = [];
    let li = 0, ri = 0, added = 0, removed = 0, modified = 0;
    for (let i = 0; i < result.ops.length;) {
      if (result.ops[i].type === 'equal') {
        rows.push({ type: 'equal', left: left[li], right: right[ri], ln: ++li, rn: ++ri, group: -1 }); i++;
        continue;
      }
      const deletes = [], inserts = [], group = groups.length;
      while (i < result.ops.length && result.ops[i].type !== 'equal') {
        if (result.ops[i++].type === 'delete') deletes.push({ text: left[li], num: ++li });
        else inserts.push({ text: right[ri], num: ++ri });
      }
      groups.push(rows.length);
      for (let j = 0; j < Math.max(deletes.length, inserts.length); j++) {
        const l = deletes[j], r = inserts[j], type = l && r ? 'modify' : l ? 'delete' : 'insert';
        if (type === 'modify') modified++; else if (l) removed++; else added++;
        rows.push({ type, left: l?.text ?? null, right: r?.text ?? null, ln: l?.num ?? null, rn: r?.num ?? null, group });
      }
    }
    return { rows, groups, added, removed, modified, coarse: result.coarse, leftLines: left.length, rightLines: right.length };
  }
  function inline(left, right, options = {}) {
    // Array.from preserves Unicode code points, including emoji surrogate pairs.
    if (left.length + right.length > 5000) return [[{ text: left, changed: true }], [{ text: right, changed: true }]];
    const original = [Array.from(left), Array.from(right)];
    const tokens = original.map(chars => chars.map((value, index) => ({ value, index })).filter(token => !options.whitespace || !/\s/u.test(token.value)));
    const [a, b] = tokens.map(list => list.map(token => token.value));
    const normalize = c => options.case ? c.toLowerCase() : c;
    const result = sequenceDiff(a.map(normalize), b.map(normalize), 40000);
    const parts = [[], []], changed = [new Set(), new Set()]; let li = 0, ri = 0;
    function add(side, text, changed) {
      const last = parts[side][parts[side].length - 1];
      if (last && last.changed === changed) last.text += text;
      else parts[side].push({ text, changed });
    }
    for (const op of result.ops) {
      if (op.type !== 'insert') { if (op.type !== 'equal') changed[0].add(tokens[0][li].index); li++; }
      if (op.type !== 'delete') { if (op.type !== 'equal') changed[1].add(tokens[1][ri].index); ri++; }
    }
    original.forEach((chars, side) => chars.forEach((char, index) => add(side, char, changed[side].has(index))));
    return parts;
  }
  const api = { compare, inline, sequenceDiff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TextDiff = api;
})(typeof self === 'undefined' ? globalThis : self);
