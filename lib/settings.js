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
};

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
