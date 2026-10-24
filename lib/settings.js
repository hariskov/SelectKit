// Settings shared by the background script, options page and content scripts.

const DEFAULT_SETTINGS = {
  targetLang: "en",
  targetCurrency: "EUR",
  wordWrapper: true,
  unitLength: "metric",
  unitWeight: "kg",
  unitTemperature: "C",
  unitVolume: "metric",
  unitSpeed: "kmh",
  unitFuel: "l100km",
  // Milliseconds between the end of a selection and the popup.
  popupDelay: 0,
  // Sites where SelectKit does nothing, as host names ("example.com").
  blockedSites: [],
};

const MAX_POPUP_DELAY = 2000;

const TARGET_LANGUAGES = {
  en: "English",
  bg: "Bulgarian",
};

// Currencies prices can be converted to. Prices in any currency are recognised.
const TARGET_CURRENCIES = ["EUR", "USD", "RON", "BGN"];

// Preferred unit per kind of measurement. Choice values are the ones
// lib/units.js converts to.
const UNIT_PREFERENCES = [
  { key: "unitLength", dim: "length", label: "Length",
    choices: { metric: "Metric (cm, m, km)", imperial: "Imperial (in, ft, mi)" } },
  { key: "unitWeight", dim: "weight", label: "Weight",
    choices: { kg: "Kilograms (g, kg)", lb: "Pounds (oz, lb)", st: "Stones (st & lb)" } },
  { key: "unitTemperature", dim: "temperature", label: "Temperature",
    choices: { C: "Celsius (°C)", F: "Fahrenheit (°F)" } },
  { key: "unitVolume", dim: "volume", label: "Volume",
    choices: { metric: "Metric (ml, L)", us: "US (fl oz, gal)", uk: "UK (fl oz, gal)" } },
  { key: "unitSpeed", dim: "speed", label: "Speed",
    choices: { kmh: "km/h", mph: "mph" } },
  { key: "unitFuel", dim: "fuel", label: "Fuel economy",
    choices: { l100km: "L/100 km", mpg_us: "mpg (US)", mpg_uk: "mpg (UK)", kml: "km/L" } },
];

const UNIT_PRESETS = {
  Metric: { unitLength: "metric", unitWeight: "kg", unitTemperature: "C", unitVolume: "metric", unitSpeed: "kmh", unitFuel: "l100km" },
  US: { unitLength: "imperial", unitWeight: "lb", unitTemperature: "F", unitVolume: "us", unitSpeed: "mph", unitFuel: "mpg_us" },
  UK: { unitLength: "imperial", unitWeight: "st", unitTemperature: "C", unitVolume: "uk", unitSpeed: "mph", unitFuel: "mpg_uk" },
};

// { length: "metric", weight: "kg", ... } as lib/units.js expects it.
function unitPrefs(settings) {
  return Object.fromEntries(UNIT_PREFERENCES.map(({ key, dim }) => [dim, settings[key]]));
}

async function getSettings() {
  const stored = await browser.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

function saveSetting(key, value) {
  return browser.storage.sync.set({ [key]: value });
}

function saveSettings(values) {
  return browser.storage.sync.set(values);
}

// "https://www.Example.com/page" -> "example.com"; null if it isn't a site.
function siteOf(urlOrHost) {
  try {
    const host = urlOrHost.includes("://") ? new URL(urlOrHost).hostname : urlOrHost.trim();
    return /^[\w-]+(\.[\w-]+)*$/.test(host) ? host.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

// The entry of `blockedSites` that covers `host` (also its subdomains), if any.
function blockingEntry(host, blockedSites) {
  const site = siteOf(host);
  return site && blockedSites.find((entry) => site === entry || site.endsWith(`.${entry}`));
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_SETTINGS, siteOf, blockingEntry };
}
