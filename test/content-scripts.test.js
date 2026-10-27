// Content scripts share one global scope, so two files declaring the same
// top-level name would stop the extension on every page.

const test = require("node:test");
const assert = require("node:assert/strict");
const { MANIFEST, loadScripts } = require("./helpers/load.js");

const listener = { addListener: () => {} };
const browser = {
  storage: { sync: { get: async () => ({}) }, local: { get: async () => ({}) }, onChanged: listener },
  runtime: { sendMessage: async () => null, onMessage: listener },
};
const page = {
  browser,
  document: { addEventListener: () => {} },
  window: { addEventListener: () => {}, getSelection: () => null },
  location: { hostname: "example.com" },
  navigator: {},
  Node: {},
};

for (const [i, { js }] of MANIFEST.content_scripts.entries()) {
  test(`content_scripts[${i}] load together without clashes`, () => {
    assert.doesNotThrow(() => loadScripts(js, page));
  });
}

test("background scripts load together without clashes", () => {
  assert.doesNotThrow(() => loadScripts(MANIFEST.background.scripts, { browser }));
});
