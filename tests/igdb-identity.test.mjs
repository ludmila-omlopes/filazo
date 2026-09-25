import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('Steam IDs select all five reported games, never a same-name search result', async () => {
  const originalFetch = globalThis.fetch;
  const originalId = process.env.IGDB_CLIENT_ID;
  const originalSecret = process.env.IGDB_CLIENT_SECRET;
  process.env.IGDB_CLIENT_ID = 'fixture'; process.env.IGDB_CLIENT_SECRET = 'fixture';
  const expected = { 400: 71, 460810: 3218, 883710: 19686, 1040420: 116166, 1145360: 113112 };
  const queries = [];
  globalThis.fetch = async (url, options) => {
    queries.push([url, options.body]);
    if (url.includes('oauth2')) return Response.json({ access_token: 'fixture', expires_in: 3600 });
    if (url.endsWith('external_game_sources')) return Response.json([{ id: 42, name: 'Steam' }]);
    if (url.endsWith('external_games')) {
      assert.match(options.body, /external_game_source = 42/);
      const app = /uid = "(\d+)"/.exec(options.body)[1];
      return Response.json(expected[app] ? [{ game: { id: expected[app], name: 'Exact game' } }] : []);
    }
    if (url.endsWith('/games')) {
      assert.match(options.body, /where id = 71/);
      return Response.json([{ id: 71, name: 'Portal' }]);
    }
    throw new Error('Unexpected request');
  };
  try {
    const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/igdb.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const exports = {};
    new Function('require', 'exports', outputText)(() => ({ selectUnambiguousTitleMatch: () => { throw new Error('Name matching must not run'); } }), exports);
    for (const [app, id] of Object.entries(expected)) {
      const result = await exports.igdbAdapter.searchBestMatch({ title: 'Homonym', provider: 'STEAM', providerGameId: app });
      assert.equal(result.igdbId, id);
    }
    assert.equal(await exports.igdbAdapter.searchBestMatch({ title: 'Portal', provider: 'STEAM', providerGameId: '999' }), null);
    assert.equal(await exports.getIgdbGameBySteamAppId('400";'), null);
    assert.equal((await exports.getIgdbGameById(71)).igdbId, 71);
    assert.equal(queries.filter(([url]) => url.endsWith('external_game_sources')).length, 1);
    assert.ok(queries.every(([, body]) => typeof body !== 'string' || !body.includes('search "')));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalId === undefined) delete process.env.IGDB_CLIENT_ID; else process.env.IGDB_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.IGDB_CLIENT_SECRET; else process.env.IGDB_CLIENT_SECRET = originalSecret;
  }
});
