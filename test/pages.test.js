const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { ROOT } = require("./helpers/load.js");

const DAY = 24 * 60 * 60 * 1000;

// An extension page from its HTML, with its scripts run against fake
// storage. Returns the window and what the page saved.
async function openExtensionPage(htmlFile, { stored = {}, rates = null, refreshed = rates } = {}) {
  const html = fs.readFileSync(path.join(ROOT, htmlFile), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map(([, src]) => path.join(ROOT, path.dirname(htmlFile), src));
  const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ""), { runScripts: "outside-only" });
  const { window } = dom;

  const sync = { ...stored };
  const listeners = [];
  const calls = { openedOptions: 0, closed: 0 };
  window.browser = {
    storage: {
      sync: {
        get: async (defaults) => ({ ...defaults, ...structuredClone(sync) }),
        set: async (values) => {
          Object.assign(sync, structuredClone(values));
          const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { newValue: v }]));
          for (const listener of listeners) listener(changes, "sync");
        },
      },
      local: { get: async () => ({ rates }) },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
    runtime: {
      getManifest: () => ({ version: "1.0.0" }),
      openOptionsPage: () => { calls.openedOptions += 1; },
      sendMessage: async (message) => (message.type === "refresh-rates" ? refreshed : undefined),
    },
  };
  window.close = () => { calls.closed += 1; };

  const context = dom.getInternalVMContext();
  for (const file of scripts) vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  const page = {
    window,
    sync,
    calls,
    $: (selector) => window.document.querySelector(selector),
    $$: (selector) => [...window.document.querySelectorAll(selector)],
    wait: (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms)),
    change(element, value) {
      if (element.type === "checkbox" || element.type === "radio") element.checked = value;
      else element.value = value;
      element.dispatchEvent(new window.Event("change", { bubbles: true }));
      return page.wait();
    },
  };
  await page.wait();
  return page;
}

test("settings page shows the defaults", async () => {
  const page = await openExtensionPage("options/options.html");
  assert.equal(page.$("input[name=targetLang]:checked").value, "en");
  assert.equal(page.$("#targetCurrency").value, "EUR");
  assert.deepEqual(page.$$("#targetCurrency option").map((o) => o.value), ["EUR", "USD", "RON", "BGN"]);
  assert.equal(page.$$("#unitPrefs select").length, 6);
  assert.deepEqual(page.$$("#unitPresets button").map((b) => [b.textContent, b.getAttribute("aria-pressed")]),
    [["Metric", "true"], ["US", "false"], ["UK", "false"]]);
  assert.equal(page.$("#wordWrapper").checked, true);
  assert.equal(page.$("#popupDelay").value, "0");
  assert.equal(page.$("#blockedSites").textContent.trim(), "No sites switched off.");
  assert.match(page.$("#ratesInfo").textContent, /haven't been downloaded/);
});

test("settings page shows stored values", async () => {
  const page = await openExtensionPage("options/options.html", {
    stored: { targetLang: "bg", targetCurrency: "RON", unitTemperature: "F", wordWrapper: false, popupDelay: 300 },
  });
  assert.equal(page.$("input[name=targetLang]:checked").value, "bg");
  assert.equal(page.$("#targetCurrency").value, "RON");
  assert.equal(page.$$("#unitPrefs select")[2].value, "F");
  assert.ok(page.$$("#unitPresets button").every((b) => b.getAttribute("aria-pressed") === "false"));
  assert.equal(page.$("#wordWrapper").checked, false);
  assert.equal(page.$("#popupDelay").value, "300");
});

test("changes are saved and confirmed", async () => {
  const page = await openExtensionPage("options/options.html");
  await page.change(page.$("input[value=bg]"), true);
  await page.change(page.$("#targetCurrency"), "BGN");
  await page.change(page.$("#wordWrapper"), false);
  assert.deepEqual(page.sync, { targetLang: "bg", targetCurrency: "BGN", wordWrapper: false });
  assert.equal(page.$("#status").textContent, "Saved");
});

test("unit presets set all six units and show as pressed", async () => {
  const page = await openExtensionPage("options/options.html");
  page.$$("#unitPresets button")[2].click();
  await page.wait();
  assert.equal(page.sync.unitWeight, "st");
  assert.equal(page.sync.unitFuel, "mpg_uk");
  assert.deepEqual(page.$$("#unitPrefs select").map((s) => s.value), ["imperial", "st", "C", "uk", "mph", "mpg_uk"]);
  assert.equal(page.$$("#unitPresets button")[2].getAttribute("aria-pressed"), "true");

  await page.change(page.$$("#unitPrefs select")[2], "F");
  assert.equal(page.$$("#unitPresets button")[2].getAttribute("aria-pressed"), "false");
});

test("popup delay is kept between 0 and 2000 ms", async () => {
  const page = await openExtensionPage("options/options.html");
  for (const [typed, saved] of [["5000", 2000], ["-50", 0], ["250.6", 251], ["abc", 0]]) {
    await page.change(page.$("#popupDelay"), typed);
    assert.equal(page.sync.popupDelay, saved, typed);
    assert.equal(page.$("#popupDelay").value, String(saved));
  }
});

test("sites can be added by address and removed", async () => {
  const page = await openExtensionPage("options/options.html");
  const add = async (text) => {
    page.$("#newSite").value = text;
    page.$("#addSite").dispatchEvent(new page.window.Event("submit", { cancelable: true }));
    await page.wait();
  };
  await add("https://www.Example.com/some/page");
  await add("news.ycombinator.com");
  await add("example.com");
  assert.deepEqual(page.sync.blockedSites, ["example.com", "news.ycombinator.com"]);
  assert.deepEqual(page.$$("#blockedSites li span").map((s) => s.textContent), ["example.com", "news.ycombinator.com"]);

  await add("not a site!");
  assert.equal(page.$("#siteError").hidden, false);
  assert.deepEqual(page.sync.blockedSites, ["example.com", "news.ycombinator.com"]);

  page.$("#blockedSites li button").click();
  await page.wait();
  assert.deepEqual(page.sync.blockedSites, ["news.ycombinator.com"]);
});

test("rates: date, source and refreshing", async () => {
  const old = { values: {}, ecbDate: "2026-10-20", otherDate: "2026-10-21", fetchedAt: Date.now() - 3 * DAY };
  const fresh = { ...old, ecbDate: "2026-10-27", fetchedAt: Date.now() };
  const page = await openExtensionPage("options/options.html", { rates: old, refreshed: fresh });
  assert.equal(page.$("#ratesInfo").textContent,
    "Rates: ECB 2026-10-20, exchange-api 2026-10-21. Downloaded 3 days ago; updated weekly.");
  page.$("#refreshRates").click();
  await page.wait();
  assert.match(page.$("#ratesInfo").textContent, /^Rates: ECB 2026-10-27, .*Downloaded today/);

  const failing = await openExtensionPage("options/options.html", { rates: old, refreshed: old });
  failing.$("#refreshRates").click();
  await failing.wait();
  assert.match(failing.$("#ratesInfo").textContent, /^Couldn't download new rates\. Rates: ECB 2026-10-20/);
});

test("toolbar panel shows the version and rates, and opens settings", async () => {
  const page = await openExtensionPage("panel/panel.html", { rates: { ecbDate: "2026-10-23" } });
  assert.match(page.$("#version").textContent, /^Version 1\.0\.0 · \d{4}-\d{2}-\d{2}$/);
  assert.equal(page.$("#rates").textContent, "Exchange rates from 2026-10-23.");
  assert.equal(page.$("#source").href, "https://github.com/hariskov/SelectKit");
  page.$("#settings").click();
  assert.deepEqual(page.calls, { openedOptions: 1, closed: 1 });

  const fresh = await openExtensionPage("panel/panel.html");
  assert.match(fresh.$("#rates").textContent, /downloaded the first time/);
});
