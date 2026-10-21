(() => {
  'use strict';
  if (location.href !== 'https://textcompare.invalid/index.html' || window.top !== window || !window.chrome?.webview) return;
  let sequence = 0;
  const pending = new Map(), actions = new Set();
  chrome.webview.addEventListener('message', event => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'action' && ['import-left', 'import-right', 'export', 'help'].includes(message.name)) {
      for (const callback of actions) callback(message.name);
    } else if (message.type === 'reply' && pending.has(message.id)) {
      const promise = pending.get(message.id); pending.delete(message.id);
      if (message.error) promise.reject(new Error(message.error)); else promise.resolve({ canceled: message.canceled === true, filename: message.filename, base64: message.base64 });
    }
  });
  Object.defineProperty(window, 'textCompareDesktop', { value: Object.freeze({
    version: '1.1.0', edition: 'WEBVIEW2 EDITION',
    saveReport: (html, filename) => new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      chrome.webview.postMessage({ type: 'save-report', id, html, filename });
    }),
    openFile: () => new Promise((resolve, reject) => {
      const id = ++sequence; pending.set(id, { resolve, reject });
      chrome.webview.postMessage({ type: 'open-file', id });
    }),
    onAction: callback => { if (typeof callback === 'function') actions.add(callback); }
  }), writable: false, configurable: false });
})();
