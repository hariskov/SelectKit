const test = require("node:test");
const assert = require("node:assert/strict");
const { MANIFEST, loadScripts } = require("./helpers/load.js");

function setUp({ targetLang = "en", rates = null } = {}) {
  const createdTabs = [];
  let onMessage;
  const browser = {
    storage: {
      sync: { get: async (defaults) => ({ ...defaults, targetLang }) },
      local: { get: async () => ({ rates }), set: async () => {} },
    },
    tabs: { create: async (tab) => createdTabs.push(tab) },
    runtime: { onMessage: { addListener: (listener) => { onMessage = listener; } } },
  };
  loadScripts(MANIFEST.background.scripts, { browser, fetch: async () => { throw new Error("offline"); }, AbortSignal });
  const send = (message, sender = {}) => onMessage(message, sender);
  return { createdTabs, send };
}

test("translate opens Google Translate right after the current tab", async () => {
  const { createdTabs, send } = setUp({ targetLang: "bg" });
  await send({ type: "translate", text: "  Hello & goodbye  " }, { tab: { id: 7, index: 2 } });
  assert.equal(createdTabs.length, 1);
  const { url, index, openerTabId } = createdTabs[0];
  const params = new URL(url).searchParams;
  assert.equal(params.get("text"), "Hello & goodbye");
  assert.equal(params.get("tl"), "bg");
  assert.equal(params.get("sl"), "auto");
  assert.equal(index, 3);
  assert.equal(openerTabId, 7);
});

test("translate without a sender tab still opens a tab", async () => {
  const { createdTabs, send } = setUp();
  await send({ type: "translate", text: "hola" });
  assert.equal(createdTabs[0].index, undefined);
  assert.equal(createdTabs[0].openerTabId, undefined);
});

test("blank text opens nothing", async () => {
  const { createdTabs, send } = setUp();
  await send({ type: "translate", text: "   " }, { tab: { id: 1, index: 0 } });
  assert.equal(createdTabs.length, 0);
});

test("rates messages answer from the cache", async () => {
  const cached = { values: { USD: 1.1 }, ecbDate: "2026-10-23", otherDate: null, fetchedAt: Date.now() };
  const { send } = setUp({ rates: cached });
  assert.equal((await send({ type: "get-rates" })).values.USD, 1.1);
});

test("unknown messages are ignored", () => {
  const { send } = setUp();
  assert.equal(send({ type: "something-else" }), undefined);
});
