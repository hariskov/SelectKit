const RATES_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const RATES_TIMEOUT = 10000;

const ECB_RATES_URL = "https://api.frankfurter.dev/v1/latest";
const EXCHANGE_API_URLS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json",
  "https://latest.currency-api.pages.dev/v1/currencies/eur.json",
];

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(RATES_TIMEOUT), cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function fetchFirst(urls) {
  let lastError;
  for (const url of urls) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function downloadRates() {
  const [ecb, other] = await Promise.allSettled([fetchJson(ECB_RATES_URL), fetchFirst(EXCHANGE_API_URLS)]);
  const values = {};
  if (other.status === "fulfilled") {
    for (const [code, value] of Object.entries(other.value.eur ?? {})) {
      if (/^[a-z]{3}$/.test(code) && value > 0) values[code.toUpperCase()] = value;
    }
  }
  if (ecb.status === "fulfilled") Object.assign(values, ecb.value.rates);
  if (!Object.keys(values).length) {
    throw new Error(`no rates: ${[ecb.reason, other.reason].filter(Boolean).join("; ")}`);
  }
  return {
    values,
    ecbDate: ecb.value?.date ?? null,
    otherDate: other.value?.date ?? null,
    fetchedAt: Date.now(),
  };
}

let pendingDownload = null;

async function getRates({ refresh = false } = {}) {
  const { rates } = await browser.storage.local.get("rates");
  if (!refresh && rates && Date.now() - rates.fetchedAt < RATES_MAX_AGE) return rates;
  pendingDownload ??= downloadRates()
    .then(async (fresh) => {
      await browser.storage.local.set({ rates: fresh });
      return fresh;
    })
    .catch((error) => {
      console.warn("SelectKit: couldn't update exchange rates", error);
      return rates ?? null;
    })
    .finally(() => {
      pendingDownload = null;
    });
  return pendingDownload;
}
