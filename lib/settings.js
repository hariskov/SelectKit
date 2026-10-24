// Settings shared by the background script, options page and content scripts.

const DEFAULT_SETTINGS = {
  targetLang: "en",
  targetCurrency: "EUR",
  wordWrapper: true,
};

const TARGET_LANGUAGES = {
  en: "English",
  bg: "Bulgarian",
};

// Currencies prices can be converted to. Prices in any currency are recognised.
const TARGET_CURRENCIES = ["EUR", "USD", "RON", "BGN"];

async function getSettings() {
  const stored = await browser.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

function saveSetting(key, value) {
  return browser.storage.sync.set({ [key]: value });
}
