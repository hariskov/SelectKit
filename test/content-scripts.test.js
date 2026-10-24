// Content scripts share one global scope, so two files declaring the same
// top-level const would stop the extension on every page. Load them all, in
// manifest order, into one context like Firefox does.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const noop = () => {};
const listener = { addListener: noop };
const stubs = {
  browser: {
    storage: { sync: { get: async () => ({}) }, local: { get: async () => ({}) }, onChanged: listener },
    runtime: { sendMessage: async () => null, onMessage: listener },
  },
  document: { addEventListener: noop },
  window: { addEventListener: noop, getSelection: () => null },
  location: { hostname: "example.com" },
  navigator: {},
  Node: {},
  setTimeout,
};

for (const [i, entry] of manifest.content_scripts.entries()) {
  test(`content_scripts[${i}] load together without clashes`, () => {
    const context = vm.createContext({ ...stubs });
    for (const file of entry.js) {
      const code = fs.readFileSync(path.join(root, file), "utf8");
      assert.doesNotThrow(() => vm.runInContext(code, context, { filename: file }), file);
    }
  });
}
