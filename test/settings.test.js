const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./helpers/load.js");
const { DEFAULT_SETTINGS, siteOf, blockingEntry } = loadScripts(["lib/settings.js"]);

test("siteOf turns URLs and host names into sites", () => {
  assert.equal(siteOf("https://www.Example.com/page?x=1"), "example.com");
  assert.equal(siteOf("example.com"), "example.com");
  assert.equal(siteOf("  sub.Site.org "), "sub.site.org");
  assert.equal(siteOf("news.bbc.co.uk"), "news.bbc.co.uk");
  assert.equal(siteOf("about:blank"), null);
  assert.equal(siteOf("localhost"), "localhost");
  assert.equal(siteOf("http://localhost:8000/page.html"), "localhost");
  assert.equal(siteOf(""), null);
});

test("blockingEntry covers the site and its subdomains only", () => {
  const list = ["example.com", "bbc.co.uk"];
  assert.equal(blockingEntry("example.com", list), "example.com");
  assert.equal(blockingEntry("www.example.com", list), "example.com");
  assert.equal(blockingEntry("a.b.example.com", list), "example.com");
  assert.equal(blockingEntry("news.bbc.co.uk", list), "bbc.co.uk");
  assert.equal(blockingEntry("notexample.com", list), null);
  assert.equal(blockingEntry("google.com", list), null);
  assert.equal(blockingEntry("localhost", list), null);
  assert.equal(blockingEntry("about:blank", list), null);
  assert.equal(blockingEntry("localhost", ["localhost"]), "localhost");
});

test("defaults: popup immediately, no blocked sites", () => {
  assert.equal(DEFAULT_SETTINGS.popupDelay, 0);
  assert.deepEqual(DEFAULT_SETTINGS.blockedSites, []);
});

const { UNIT_PREFERENCES, UNIT_PRESETS, TARGET_CURRENCIES, unitPrefs, getSettings } =
  loadScripts(["lib/settings.js"], {
    browser: { storage: { sync: { get: async (defaults) => ({ ...defaults, targetLang: "bg" }) } } },
  });

test("every default and preset unit is one of the offered choices", () => {
  for (const { key, choices } of UNIT_PREFERENCES) {
    assert.ok(DEFAULT_SETTINGS[key] in choices, `default ${key}`);
    for (const [name, preset] of Object.entries(UNIT_PRESETS)) {
      assert.ok(preset[key] in choices, `${name} ${key}`);
    }
  }
  assert.deepEqual(UNIT_PRESETS.Metric, Object.fromEntries(UNIT_PREFERENCES.map(({ key }) => [key, DEFAULT_SETTINGS[key]])));
});

test("unitPrefs maps settings to what lib/units.js expects", () => {
  assert.deepEqual(unitPrefs({ ...DEFAULT_SETTINGS, ...UNIT_PRESETS.UK }), {
    length: "imperial", weight: "st", temperature: "C", volume: "uk", speed: "mph", fuel: "mpg_uk",
  });
});

test("the default target currency is offered", () => {
  assert.ok(TARGET_CURRENCIES.includes(DEFAULT_SETTINGS.targetCurrency));
});

test("getSettings fills in defaults", async () => {
  const settings = await getSettings();
  assert.equal(settings.targetLang, "bg");
  assert.equal(settings.targetCurrency, "EUR");
});
