(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const desktop = window.textCompareDesktop;
  const sides = ['left', 'right'], MAX_CHARS = 2000000, MAX_FILE = 5 * 1024 * 1024, PAGE_SIZE = 400;
  const engine = $('diff-engine').textContent;
  const engineTag = document.createElement('script'); engineTag.textContent = engine; document.head.append(engineTag);
  const workerUrl = URL.createObjectURL(new Blob([engine, '\nself.onmessage = e => { try { self.postMessage({result: TextDiff.compare(e.data.left, e.data.right, e.data.options)}); } catch(error) { self.postMessage({error: error.message}); } };'], { type: 'text/javascript' }));
  let worker = null, revision = 0, timer, toastTimer, result = null, snapshot = null, currentGroup = -1, page = 0, visibleRows = [], stale = true;
  const names = { left: '', right: '' }, importSequence = { left: 0, right: 0 };
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000); }
  function getOptions() { return { whitespace: $('ignore-space').checked, case: $('ignore-case').checked }; }
  function safeRead(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function removeSaved() { try { localStorage.removeItem('text-compare-content-v1'); } catch {} }
  function saveContent() {
    if (!$('remember').checked) return;
    try { localStorage.setItem('text-compare-content-v1', JSON.stringify({ left: $('left').value, right: $('right').value, names })); }
    catch { toast('浏览器存储空间不足，未能保留文本。请导出报告或自行备份。'); }
  }
  function updateCounts() {
    for (const side of sides) {
      const value = $(side).value, lineCount = value === '' ? 0 : value.split('\n').length;
      $(side + '-count').textContent = value.length.toLocaleString() + ' 字符 · ' + lineCount.toLocaleString() + ' 行';
      $(side + '-name').textContent = names[side] || '未导入文件'; $(side + '-name').title = names[side];
    }
  }
  function dirty(schedule = true) {
    revision++; stale = true; clearTimeout(timer);
    if (worker) { worker.terminate(); worker = null; }
    $('compare').disabled = false; $('compare').firstChild.textContent = '开始对比 ';
    $('stale').hidden = !result; $('export').disabled = true;
    $('prev').disabled = true; $('next').disabled = true;
    updateCounts(); saveContent();
    if ($('auto').checked && schedule) timer = setTimeout(compare, 350);
  }
  function compare() {
    clearTimeout(timer);
    if (sides.some(side => $(side).value.length > MAX_CHARS || $(side).value.split('\n').length > 100000)) { toast('每侧最多支持 200 万字符、10 万行，请缩小文本后重试。'); return; }
    if (worker) worker.terminate();
    const token = ++revision, started = performance.now();
    const data = { left: $('left').value, right: $('right').value, options: getOptions(), names: { ...names } };
    $('summary').textContent = '正在计算差异…'; $('compare').disabled = true; $('compare').firstChild.textContent = '正在对比 ';
    const activeWorker = new Worker(workerUrl); worker = activeWorker;
    const failed = message => {
      if (token !== revision) return;
      activeWorker.terminate(); worker = null; $('compare').disabled = false; $('compare').firstChild.textContent = '开始对比 ';
      $('summary').textContent = '对比未完成'; toast(message);
    };
    activeWorker.onerror = () => failed('浏览器未能运行本地计算，请用新版 Edge 或 Chrome 打开。');
    activeWorker.onmessage = event => {
      if (token !== revision) return;
      if (event.data.error) { failed('对比失败：' + event.data.error); return; }
      activeWorker.terminate(); worker = null;
      result = event.data.result; snapshot = data; stale = false; currentGroup = -1; page = 0;
      $('compare').disabled = false; $('compare').firstChild.textContent = '开始对比 ';
      $('stale').hidden = true; $('export').disabled = !data.left && !data.right;
      $('summary').textContent = result.groups.length ? result.groups.length + ' 处差异' : (!data.left && !data.right ? '等待输入' : '文本一致' + ((data.options.whitespace || data.options.case) ? '（按当前忽略规则）' : ''));
      $('modified').textContent = result.modified + ' 行修改'; $('added').textContent = result.added + ' 行新增'; $('removed').textContent = result.removed + ' 行删除';
      $('timing').textContent = Math.round(performance.now() - started) + ' ms · ' + result.leftLines.toLocaleString() + ' / ' + result.rightLines.toLocaleString() + ' 行';
      const hasText = Boolean(data.left || data.right);
      $('result-meta').hidden = !hasText; $('diff-titles').hidden = !hasText; $('coarse').hidden = !result.coarse;
      $('result-left-name').textContent = data.names.left || '原始文本'; $('result-right-name').textContent = data.names.right || '修改后文本';
      buildView();
    };
    activeWorker.postMessage(data);
  }
  function buildView() {
    if (!result) return;
    visibleRows = result.rows.filter(row => !$('only-changes').checked || row.type !== 'equal');
    page = Math.min(page, Math.max(0, Math.ceil(visibleRows.length / PAGE_SIZE) - 1));
    renderPage(); updateNavigation();
  }
  function cell(row, side, parts) {
    const value = row[side], number = row[side === 'left' ? 'ln' : 'rn'];
    const el = document.createElement('div'); el.className = 'diff-cell';
    if (value === null) el.classList.add('absent');
    else if (row.type !== 'equal') el.classList.add(side === 'left' ? 'deleted' : 'inserted');
    const num = document.createElement('span'); num.className = 'line-number'; num.textContent = number ?? ''; num.setAttribute('aria-hidden', 'true');
    const code = document.createElement('pre'); code.className = 'line-code';
    if (parts) {
      for (const part of parts) { const span = document.createElement(part.changed ? 'mark' : 'span'); span.textContent = part.text; code.append(span); }
    } else code.textContent = value ?? '';
    el.append(num, code); return el;
  }
  function renderPage() {
    const content = $('diff-content'); content.replaceChildren();
    const fragment = document.createDocumentFragment(), start = page * PAGE_SIZE;
    for (const row of visibleRows.slice(start, start + PAGE_SIZE)) {
      const line = document.createElement('div'); line.className = 'diff-row' + (row.group === currentGroup && currentGroup >= 0 ? ' selected' : '');
      if (row.group >= 0) line.dataset.group = row.group;
      const parts = row.type === 'modify' ? TextDiff.inline(row.left, row.right, snapshot.options) : null;
      line.append(cell(row, 'left', parts?.[0]), cell(row, 'right', parts?.[1])); fragment.append(line);
    }
    content.append(fragment); $('empty').hidden = Boolean(snapshot && (snapshot.left || snapshot.right));
    $('pager').hidden = visibleRows.length <= PAGE_SIZE;
    $('previous-page').disabled = page === 0; $('more').disabled = (page + 1) * PAGE_SIZE >= visibleRows.length;
    $('page-range').textContent = (start + 1).toLocaleString() + '–' + Math.min(start + PAGE_SIZE, visibleRows.length).toLocaleString() + ' / ' + visibleRows.length.toLocaleString() + ' 行';
    if (snapshot && (snapshot.left || snapshot.right) && !visibleRows.length) {
      const message = document.createElement('div'); message.className = 'empty'; message.textContent = '当前规则下没有差异。取消“只看差异”可查看全部文本。'; content.append(message);
    }
    $('diff-scroll').scrollTop = 0;
  }
  function updateNavigation() {
    const count = result?.groups.length || 0;
    $('position').textContent = (currentGroup < 0 ? 0 : currentGroup + 1) + ' / ' + count;
    $('prev').disabled = !count || stale; $('next').disabled = !count || stale;
  }
  function navigate(direction) {
    if (!result?.groups.length || stale) return;
    currentGroup = currentGroup < 0 ? (direction > 0 ? 0 : result.groups.length - 1) : (currentGroup + direction + result.groups.length) % result.groups.length;
    const index = visibleRows.findIndex(row => row.group === currentGroup);
    page = Math.floor(index / PAGE_SIZE); renderPage(); updateNavigation();
    const selected = $('diff-content').querySelector('[data-group="' + currentGroup + '"]');
    if (selected) { $('diff-scroll').scrollTop = Math.max(0, selected.offsetTop - $('diff-content').offsetTop - 36); selected.scrollIntoView({ block: 'nearest' }); }
  }
  async function importFile(side, file) {
    if (!file) return;
    if (file.size > MAX_FILE) { toast('文件不能超过 5 MB。'); return; }
    const token = ++importSequence[side];
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()); if (token !== importSequence[side]) return;
      const encoding = $(side + '-encoding').value;
      const utf16Bom = (bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255);
      const binaryMagic = (bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4) || (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70);
      if (binaryMagic || (!utf16Bom && !encoding.startsWith('utf-16') && bytes.slice(0, 4096).includes(0))) { toast('请选择纯文本文件；不支持 PDF、Word、Excel 等二进制文档。'); return; }
      const resolved = utf16Bom ? (bytes[0] === 255 ? 'utf-16le' : 'utf-16be') : encoding;
      const text = new TextDecoder(resolved).decode(bytes);
      if (text.length > MAX_CHARS) { toast('文本超过 200 万字符，请缩小后重试。'); return; }
      $(side).value = text; names[side] = file.name; dirty();
      toast('已导入 ' + file.name + (text.includes('\uFFFD') ? '；检测到替换字符，如有乱码请更换编码后重新导入。' : ''));
    } catch { toast('读取文件失败，请检查文件权限或编码。'); }
  }
  async function chooseFile(side) {
    if (!desktop?.openFile) { $(side + '-file').click(); return; }
    const token = ++importSequence[side];
    try {
      const selected = await desktop.openFile();
      if (selected.canceled || token !== importSequence[side]) return;
      const bytes = Uint8Array.from(atob(selected.base64), char => char.charCodeAt(0));
      await importFile(side, new File([bytes], selected.filename));
    } catch (error) { toast(error.message || '文件导入失败，请重试。'); }
  }
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  async function exportReport() {
    if (!result || stale || !snapshot) return;
    const rows = result.rows.map(row => '<tr class="' + row.type + '"><td class="num">' + (row.ln ?? '') + '</td><td class="l">' + escapeHtml(row.left) + '</td><td class="num">' + (row.rn ?? '') + '</td><td class="r">' + escapeHtml(row.right) + '</td></tr>').join('');
    const rules = [snapshot.options.whitespace && '忽略所有空白', snapshot.options.case && '忽略大小写'].filter(Boolean).join('、') || '无';
    const report = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'"><title>文本对比报告</title><style>body{font:14px system-ui,sans-serif;color:#263046;margin:30px}h1{font-size:24px}p{color:#6c778c;font-size:12px}table{width:100%;table-layout:fixed;border-collapse:collapse;font:12px/1.8 Consolas,monospace}td,th{border:1px solid #e3e8ef;padding:3px 10px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#f3f5fa;text-align:left}.num{width:45px;color:#98a2b3;text-align:right}.delete .l,.modify .l{background:#fff0f1}.insert .r,.modify .r{background:#edf9f1}@media print{body{margin:5mm}thead{display:table-header-group}tr{break-inside:avoid}}</style><h1>文本对比报告</h1><p>' + escapeHtml(new Date().toLocaleString('zh-CN')) + ' · ' + result.groups.length + ' 处差异 · ' + result.modified + ' 行修改 / ' + result.added + ' 行新增 / ' + result.removed + ' 行删除</p><p>忽略规则：' + escapeHtml(rules) + '。CRLF / LF 统一处理。' + (result.coarse ? '差异较多，使用整段对齐。' : '') + '</p><table><colgroup><col style="width:45px"><col><col style="width:45px"><col></colgroup><thead><tr><th></th><th>' + escapeHtml(snapshot.names.left || '原始文本') + '</th><th></th><th>' + escapeHtml(snapshot.names.right || '修改后文本') + '</th></tr></thead><tbody>' + rows + '</tbody></table></html>';
    const filename = '文本对比报告-' + new Date().toISOString().slice(0, 10) + '.html';
    if (desktop) {
      try { const saved = await desktop.saveReport(report, filename); if (!saved.canceled) toast('对比报告已保存。'); }
      catch { toast('报告保存失败，请检查文件夹权限后重试。'); }
      return;
    }
    const url = URL.createObjectURL(new Blob([report], { type: 'text/html;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('已生成报告，请查看浏览器下载。');
  }
  for (const side of sides) {
    $(side).addEventListener('input', () => { importSequence[side]++; dirty(); });
    $(side + '-file').addEventListener('change', event => { importFile(side, event.target.files[0]); event.target.value = ''; });
    const editor = document.querySelector('[data-side="' + side + '"]');
    editor.addEventListener('dragover', event => { event.preventDefault(); editor.classList.add('drag'); });
    editor.addEventListener('dragleave', event => { if (!editor.contains(event.relatedTarget)) editor.classList.remove('drag'); });
    editor.addEventListener('drop', event => { event.preventDefault(); editor.classList.remove('drag'); importFile(side, event.dataTransfer.files[0]); });
  }
  document.addEventListener('dragover', event => event.preventDefault()); document.addEventListener('drop', event => event.preventDefault());
  document.querySelectorAll('[data-import]').forEach(button => button.addEventListener('click', () => chooseFile(button.dataset.import)));
  document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.format);
    try { input.value = JSON.stringify(JSON.parse(input.value), null, 2); dirty(); toast('JSON 已格式化；键顺序保持不变。'); } catch { toast('当前文本不是有效 JSON，未修改内容。'); }
  }));
  $('compare').addEventListener('click', compare);
  $('swap').addEventListener('click', () => {
    for (const side of sides) importSequence[side]++;
    const temp = $('left').value; $('left').value = $('right').value; $('right').value = temp;
    [names.left, names.right] = [names.right, names.left]; dirty();
  });
  $('clear').addEventListener('click', () => {
    for (const side of sides) { $(side).value = ''; names[side] = ''; importSequence[side]++; }
    $('remember').checked = false; removeSaved(); dirty(false); compare();
  });
  $('example').addEventListener('click', () => {
    if (($('left').value || $('right').value) && !confirm('载入示例会替换当前两侧文本，是否继续？')) return;
    $('left').value = '{\n  "name": "文本对比工具",\n  "version": "1.0.0",\n  "offline": true,\n  "theme": "light",\n  "features": ["文本对比", "文件导入"],\n  "note": "让每一处变化清晰可见"\n}';
    $('right').value = '{\n  "name": "文本对比工具",\n  "version": "1.1.0",\n  "offline": true,\n  "theme": "dark",\n  "features": ["文本对比", "文件导入", "报告导出"],\n  "privacy": "数据仅在本地处理",\n  "note": "让每一处变化清晰可见"\n}';
    names.left = 'config.before.json'; names.right = 'config.after.json';
    for (const side of sides) importSequence[side]++;
    dirty(); compare();
  });
  $('ignore-space').addEventListener('change', () => dirty()); $('ignore-case').addEventListener('change', () => dirty());
  $('auto').addEventListener('change', () => { if ($('auto').checked && stale) compare(); else clearTimeout(timer); });
  $('only-changes').addEventListener('change', () => { page = 0; buildView(); });
  $('wrap').addEventListener('change', () => $('diff-content').classList.toggle('nowrap', !$('wrap').checked));
  $('remember').addEventListener('change', () => { if ($('remember').checked) { saveContent(); toast('已在当前浏览器保留文本。'); } else { removeSaved(); toast('已删除本地保留的文本。'); } });
  $('edit-toggle').addEventListener('click', () => { $('editors').hidden = !$('editors').hidden; $('edit-toggle').textContent = $('editors').hidden ? '展开输入区' : '收起输入区'; });
  $('prev').addEventListener('click', () => navigate(-1)); $('next').addEventListener('click', () => navigate(1));
  $('more').addEventListener('click', () => { page++; renderPage(); }); $('previous-page').addEventListener('click', () => { page--; renderPage(); });
  $('export').addEventListener('click', exportReport);
  $('theme').addEventListener('click', () => { document.body.classList.toggle('dark'); try { localStorage.setItem('text-compare-theme-v1', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch {} });
  $('help').addEventListener('click', () => $('help-dialog').showModal());
  for (const id of ['close-help', 'close-help-bottom']) $(id).addEventListener('click', () => $('help-dialog').close());
  document.addEventListener('keydown', event => {
    if (desktop && !event.altKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
      event.preventDefault(); chooseFile(event.shiftKey ? 'right' : 'left'); return;
    }
    if (desktop && !event.altKey && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's') {
      event.preventDefault(); if (!$('export').disabled) exportReport(); else toast('请先完成文本对比，再导出报告。'); return;
    }
    if (desktop && event.key === 'F1') { event.preventDefault(); if (!$('help-dialog').open) $('help-dialog').showModal(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); compare(); }
    if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && !event.target.matches('textarea,input,select')) { event.preventDefault(); navigate(event.key === 'ArrowDown' ? 1 : -1); }
  });
  document.body.classList.toggle('dark', safeRead('text-compare-theme-v1') === 'dark');
  const saved = safeRead('text-compare-content-v1');
  if (saved) { try { const data = JSON.parse(saved); for (const side of sides) { $(side).value = typeof data[side] === 'string' ? data[side].slice(0, MAX_CHARS) : ''; names[side] = typeof data.names?.[side] === 'string' ? data.names[side] : ''; } $('remember').checked = true; updateCounts(); compare(); } catch { removeSaved(); } }
  else updateCounts();
  if (desktop) {
    document.querySelector('.version').textContent = desktop.edition || 'DESKTOP EDITION';
    document.querySelector('.remember').lastChild.textContent = '在此应用保留文本';
    document.querySelector('#help-dialog > p').textContent = '双击 TextCompare.exe 即可打开，无需安装、账号或网络。';
    document.querySelectorAll('#help-dialog li').forEach(item => { item.textContent = item.textContent.replace(/浏览器/g, '应用'); });
    desktop.onAction(name => {
      if (name === 'import-left' || name === 'import-right') chooseFile(name.replace('import-', ''));
      else if (name === 'export') { if (!$('export').disabled) exportReport(); else toast('请先完成文本对比，再导出报告。'); }
      else if (name === 'help' && !$('help-dialog').open) $('help-dialog').showModal();
    });
  }
  window.addEventListener('pagehide', () => { worker?.terminate(); });
})();
