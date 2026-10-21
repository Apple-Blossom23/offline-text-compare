import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
let template = await readFile(new URL('src/index.template.html', root), 'utf8');
for (const [marker, file] of [['STYLE', 'style.css'], ['ENGINE', 'diff-engine.js'], ['APP', 'app.js']]) {
  const source = await readFile(new URL('src/' + file, root), 'utf8');
  if (/<\/script/i.test(source)) throw new Error('Embedded source must not contain a closing script tag: ' + file);
  template = template.replace('/* INLINE_' + marker + ' */', () => source);
}
await writeFile(new URL('index.html', root), template, 'utf8');
console.log('Built single-file offline app: ' + fileURLToPath(new URL('index.html', root)));
