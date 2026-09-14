import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import ts from 'typescript';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(await read('../dist/manifest.webmanifest'));
assert.equal(manifest.id, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.display, 'standalone');
for (const size of [192, 512]) {
  const icon = manifest.icons.find((i) => i.sizes === `${size}x${size}` && i.purpose === 'any');
  assert.ok(icon, `Ícone de ${size}px ausente`);
  const svg = await read(`../dist${icon.src}`);
  assert.ok(svg.includes(`width="${size}"`));
  assert.ok(svg.includes(`height="${size}"`));
  assert.ok(svg.includes('FORJA'));
  assert.ok(svg.includes('#dc2626'));
}
const html = await read('../dist/index.html');
assert.match(html, /rel="manifest"/);
assert.match(html, /icons\/forja-192.svg/);
const sw = await read('../dist/sw.js');
assert.ok(sw.includes('icons/forja-192.svg'));
assert.ok(sw.includes('icons/forja-512.svg'));

// Exercita captura antecipada, evento consumido uma vez, cancelamento e instalação.
const handlers = new Map();
const media = { matches: false, addEventListener() {} };
const exports = {};
const context = createContext({
  exports,
  window: {
    matchMedia: () => media,
    addEventListener: (name, callback) => handlers.set(name, callback),
  },
});
const source = await read('../src/lib/pwa-install.ts');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Script(compiled).runInContext(context);
assert.equal(exports.getInstallSnapshot().available, false);
assert.equal(await exports.installForja(), 'unavailable');
let notifications = 0;
const unsubscribe = exports.subscribeInstall(() => notifications++);
let prompts = 0;
let prevented = false;
handlers.get('beforeinstallprompt')({
  preventDefault() { prevented = true; },
  async prompt() { prompts++; },
  userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
});
assert.equal(prevented, true);
assert.equal(exports.getInstallSnapshot().available, true);
assert.equal(await exports.installForja(), 'dismissed');
assert.equal(await exports.installForja(), 'unavailable');
assert.equal(prompts, 1);
handlers.get('appinstalled')();
assert.equal(exports.getInstallSnapshot().installed, true);
assert.equal(exports.getInstallSnapshot().available, false);
assert.ok(notifications > 0);
unsubscribe();
console.log('PWA: manifesto, ícones, precache e ciclo de instalação verificados.');
