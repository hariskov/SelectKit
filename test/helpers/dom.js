const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { ROOT, MANIFEST } = require("./load.js");

const CONTENT_SCRIPTS = MANIFEST.content_scripts[0].js.map((file) => fs.readFileSync(path.join(ROOT, file), "utf8"));

// A page with the content scripts loaded, and fake extension APIs.
function openPage(html, { url = "http://localhost/", settings = {}, rates = null } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  const messages = [];
  const clipboard = [];
  let onStorageChanged;
  window.browser = {
    storage: {
      sync: { get: async (defaults) => ({ ...defaults, ...settings }) },
      onChanged: { addListener: (listener) => { onStorageChanged = listener; } },
    },
    runtime: {
      sendMessage: async (message) => {
        messages.push(structuredClone(message));
        return message.type === "get-rates" ? structuredClone(rates) : undefined;
      },
    },
  };
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: async (text) => { clipboard.push(text); } },
  });
  // As separate scripts sharing one global scope, like Firefox; window.eval
  // would keep each file's top-level const to itself.
  const context = dom.getInternalVMContext();
  for (const code of CONTENT_SCRIPTS) vm.runInContext(code, context);
  const global = (name) => vm.runInContext(name, context);

  const document = window.document;
  const page = {
    window,
    document,
    messages,
    clipboard,
    global,
    changeSettings(changes) {
      onStorageChanged(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, { newValue: v }])), "sync");
    },
    // Selects from `start` in the first text containing `startText` to `end`
    // in the first text containing `endText` (offsets within those nodes).
    select(startText, start, endText = startText, end = start) {
      const node = (text) => {
        const walker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.includes(text)) return n;
        throw new Error(`no text node with "${text}"`);
      };
      window.getSelection().setBaseAndExtent(node(startText), start, node(endText), end);
    },
    selection: () => window.getSelection().toString(),
    async mouseUp(target = document.body, init = {}) {
      target.dispatchEvent(new window.MouseEvent("mouseup", { bubbles: true, button: 0, detail: 1, clientX: 20, clientY: 20, ...init }));
      await page.wait();
    },
    mouseDown(target = document.body) {
      target.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
    },
    wait: (ms = 5) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    popupOpen: () => global("popup.isOpen"),
    buttons: () => [...global("popup.box")?.querySelectorAll("button") ?? []],
    labels: () => page.buttons().map((b) => b.textContent),
    button: (label) => page.buttons().find((b) => b.textContent.includes(label)),
  };
  return page;
}

module.exports = { openPage };
