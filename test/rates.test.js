const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./helpers/load.js");

const DAY = 24 * 60 * 60 * 1000;
const ECB = { date: "2026-10-23", rates: { USD: 1.12, RON: 5.35 } };
const OTHER = { date: "2026-10-24", eur: { usd: 1.13, vnd: 29000, aed: 4.1, btc: 0.00001, "1inch": 3, bad: -1 } };

// Responses by URL prefix: an object is served as JSON, a number as an HTTP
// error, an Error is thrown (network failure).
function setUp(responses, stored = {}) {
  const storage = { ...stored };
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    const key = Object.keys(responses).find((prefix) => url.startsWith(prefix));
    const response = responses[key];
    if (response instanceof Error || response === undefined) throw response ?? new Error("offline");
    if (typeof response === "number") return { ok: false, status: response };
    return { ok: true, json: async () => structuredClone(response) };
  };
  const browser = {
    storage: {
      local: {
        get: async (key) => ({ [key]: storage[key] }),
        set: async (values) => Object.assign(storage, structuredClone(values)),
      },
    },
  };
  const silent = { ...console, warn: () => {} };
  const lib = loadScripts(["lib/rates.js"], { fetch, browser, AbortSignal, console: silent });
  return { lib, storage, requests };
}

const ECB_URL = "https://api.frankfurter.dev/";
const JSDELIVR = "https://cdn.jsdelivr.net/";
const PAGES = "https://latest.currency-api.pages.dev/";

test("merges both sources, ECB wins, junk is dropped", async () => {
  const { lib, storage } = setUp({ [ECB_URL]: ECB, [JSDELIVR]: OTHER });
  const rates = await lib.getRates();
  assert.deepEqual(rates.values, { USD: 1.12, RON: 5.35, VND: 29000, AED: 4.1, BTC: 0.00001 });
  assert.equal(rates.ecbDate, "2026-10-23");
  assert.equal(rates.otherDate, "2026-10-24");
  assert.deepEqual(storage.rates.values, rates.values);
});

test("falls back to the second exchange-api host", async () => {
  const { lib, requests } = setUp({ [ECB_URL]: ECB, [JSDELIVR]: 503, [PAGES]: OTHER });
  const rates = await lib.getRates();
  assert.equal(rates.values.VND, 29000);
  assert.ok(requests.some((url) => url.startsWith(PAGES)));
});

test("one source is enough", async () => {
  const onlyEcb = await setUp({ [ECB_URL]: ECB }).lib.getRates();
  assert.deepEqual(onlyEcb.values, ECB.rates);
  assert.equal(onlyEcb.otherDate, null);
  const onlyOther = await setUp({ [JSDELIVR]: OTHER }).lib.getRates();
  assert.equal(onlyOther.values.USD, 1.13);
  assert.equal(onlyOther.ecbDate, null);
});

test("uses the cache for 7 days, then downloads again", async () => {
  const cached = { values: { USD: 1 }, ecbDate: "2026-10-01", otherDate: null, fetchedAt: Date.now() - 6 * DAY };
  const fresh = setUp({ [ECB_URL]: ECB, [JSDELIVR]: OTHER }, { rates: cached });
  assert.equal((await fresh.lib.getRates()).values.USD, 1);
  assert.equal(fresh.requests.length, 0);

  const old = setUp({ [ECB_URL]: ECB, [JSDELIVR]: OTHER }, { rates: { ...cached, fetchedAt: Date.now() - 8 * DAY } });
  assert.equal((await old.lib.getRates()).values.USD, 1.12);
  assert.equal(old.requests.length, 2);
});

test("refresh downloads even when the cache is fresh", async () => {
  const cached = { values: { USD: 1 }, ecbDate: null, otherDate: null, fetchedAt: Date.now() };
  const { lib } = setUp({ [ECB_URL]: ECB }, { rates: cached });
  assert.equal((await lib.getRates({ refresh: true })).values.USD, 1.12);
});

test("a failed download keeps the cached rates, or gives null", async () => {
  const cached = { values: { USD: 1 }, ecbDate: null, otherDate: null, fetchedAt: Date.now() - 30 * DAY };
  const offline = setUp({}, { rates: cached });
  assert.equal((await offline.lib.getRates()).values.USD, 1);
  assert.equal(offline.storage.rates.fetchedAt, cached.fetchedAt);

  assert.equal(await setUp({}).lib.getRates(), null);
  assert.equal(await setUp({ [ECB_URL]: 500, [JSDELIVR]: 500, [PAGES]: 500 }).lib.getRates(), null);
});

test("concurrent requests share one download", async () => {
  const { lib, requests } = setUp({ [ECB_URL]: ECB, [JSDELIVR]: OTHER });
  const [a, b] = await Promise.all([lib.getRates(), lib.getRates()]);
  assert.deepEqual(a, b);
  assert.equal(requests.length, 2);
});
