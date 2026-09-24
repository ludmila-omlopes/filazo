import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const normalizeTitle = value => value.replace(/[™®©]/g, '').normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/catalog-match.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const exports = {};
new Function('require', 'exports', outputText)(() => ({ normalizeTitle }), exports);
const { selectUnambiguousTitleMatch: match } = exports;
const game = (id, name, platform = 'PC (Microsoft Windows)') => ({ id, name, platforms: [{ name: platform }] });

test('same-name PC games and remakes are ambiguous regardless of API order', () => {
  for (const name of ['Portal', 'Hades', 'Vanquish', 'Resident Evil 2', 'Dreamscaper']) {
    const results = [game(1, name), game(2, name)];
    assert.equal(match(name, results, 'Steam'), null);
    assert.equal(match(name, results.reverse(), 'Steam'), null);
  }
});
test('platform aliases disambiguate old consoles without preferring older or newer games', () => {
  const results = [game(1, 'Portal', 'Commodore C64/128/MAX'), game(2, 'Portal')];
  assert.equal(match('Portal', results, 'Steam').id, 2);
  assert.equal(match('Portal', results, 'Commodore C64/128/MAX').id, 1);
  assert.equal(match('Portal', results), null);
});
test('prefix, sequel, different number and wrong platform cannot substitute for a title', () => {
  assert.equal(match('Resident Evil 2', [game(1, 'Resident Evil 3')]), null);
  assert.equal(match('Portal', [game(1, 'Portal 2')]), null);
  assert.equal(match('Hades', [game(1, 'Hades', 'DOS')], 'Steam'), null);
  assert.equal(match('Hades™', [game(1, 'Hades')], 'Steam').id, 1);
  assert.equal(match('Hades', [game(1, 'Hades', 'PlayStation 5')], 'PS4, PS5').id, 1);
  assert.equal(match('Hades', [game(1, 'Hades', 'Xbox Series X|S')], 'Xbox Series X/S').id, 1);
});
