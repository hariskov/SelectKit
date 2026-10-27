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
  popupDelay: 0,
  blockedSites: [],
};

const MAX_POPUP_DELAY = 2000;

const TARGET_LANGUAGES = {
  en: "English",
  bg: "Bulgarian",
};

const TARGET_CURRENCIES = ["EUR", "USD", "RON", "BGN"];

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

function unitPrefs(settings) {
  return Object.fromEntries(UNIT_PREFERENCES.map(({ key, dim }) => [dim, settings[key]]));
}

function getSettings() {
  return browser.storage.sync.get(DEFAULT_SETTINGS);
}

function saveSettings(values) {
  return browser.storage.sync.set(values);
}

// "https://www.Example.com/page" -> "example.com"
function siteOf(urlOrHost) {
  try {
    const host = urlOrHost.includes("://") ? new URL(urlOrHost).hostname : urlOrHost.trim();
    return /^[\w-]+(\.[\w-]+)*$/.test(host) ? host.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function blockingEntry(host, blockedSites) {
  const site = siteOf(host);
  return site ? blockedSites.find((entry) => site === entry || site.endsWith(`.${entry}`)) ?? null : null;
}
