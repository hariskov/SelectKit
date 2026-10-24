// Finding measurements in text and converting them to the preferred units.
// Pure logic: content scripts get NUMBER_PATTERN/parseNumber from
// lib/numbers.js as globals, the Node tests through require.

const { NUMBER_PATTERN: NUM, parseNumber: readNumber } = typeof module !== "undefined"
  ? require("./numbers.js")
  : { NUMBER_PATTERN, parseNumber };

// Case-insensitive letters for a plain word ("km" -> "[kK][mM]").
const ci = (word) => word.replace(/[a-z]/g, (c) => `[${c}${c.toUpperCase()}]`);

const US_UK = {
  floz: { us: 0.0295735295625, uk: 0.0284130625 },
  pt: { us: 0.473176473, uk: 0.56826125 },
  qt: { us: 0.946352946, uk: 1.1365225 },
  gal: { us: 3.785411784, uk: 4.54609 },
};
const MPG_TO_L100 = { us: 235.214583, uk: 282.480936 };
const LB = 0.45359237;
const INCH = 0.0254;
const MILE = 1609.344;

// Base units: length m, weight kg, volume l, speed km/h, temperature °C,
// fuel economy l/100 km. `system` is what the preference is compared with;
// a function means it depends on the page (US or UK gallons).
// Longer names come first where a shorter one would also match ("km/h"
// before "km").
const UNITS = [
  { id: "l100", dim: "fuel", system: "l100km", toBase: (v) => v,
    names: [String.raw`[lL]\s?/\s?100\s?${ci("km")}`, String.raw`${ci("lit")}(?:${ci("er")}|${ci("re")})${ci("s")}?\s${ci("per")}\s100\s?${ci("km")}`] },
  { id: "kml", dim: "fuel", system: "kml", toBase: (v) => 100 / v,
    names: [String.raw`${ci("km")}\s?/\s?[lL]`, ci("kmpl")] },
  { id: "mpg", dim: "fuel", system: (uk) => (uk ? "mpg_uk" : "mpg_us"),
    toBase: (v, uk) => MPG_TO_L100[uk ? "uk" : "us"] / v,
    names: [ci("mpg"), String.raw`${ci("miles")}?\s${ci("per")}\s${ci("gallon")}`] },
  { id: "kmh", dim: "speed", system: "kmh", toBase: (v) => v,
    names: [String.raw`${ci("km")}\s?/\s?${ci("hr")}?`, ci("kmh"), ci("kph"), String.raw`${ci("kilomet")}(?:${ci("er")}|${ci("re")})${ci("s")}?\s${ci("per")}\s${ci("hour")}`] },
  { id: "mph", dim: "speed", system: "mph", toBase: (v) => v * MILE / 1000,
    names: [ci("mph"), String.raw`${ci("mi")}\s?/\s?${ci("h")}`, String.raw`${ci("mile")}${ci("s")}?\s${ci("per")}\s${ci("hour")}`] },
  { id: "floz", dim: "volume", system: (uk) => (uk ? "uk" : "us"), toBase: (v, uk) => v * US_UK.floz[uk ? "uk" : "us"],
    names: [String.raw`${ci("fl")}\.?\s?${ci("oz")}`, String.raw`${ci("fluid")}\s${ci("ounce")}${ci("s")}?`] },

  { id: "mm", dim: "length", system: "metric", toBase: (v) => v / 1000,
    names: [ci("mm"), String.raw`${ci("millimet")}(?:${ci("er")}|${ci("re")})${ci("s")}?`] },
  { id: "cm", dim: "length", system: "metric", toBase: (v) => v / 100,
    names: [ci("cm"), String.raw`${ci("centimet")}(?:${ci("er")}|${ci("re")})${ci("s")}?`] },
  { id: "km", dim: "length", system: "metric", toBase: (v) => v * 1000,
    names: [ci("kms"), ci("km"), String.raw`${ci("kilomet")}(?:${ci("er")}|${ci("re")})${ci("s")}?`] },
  { id: "m", dim: "length", system: "metric", toBase: (v) => v,
    names: ["m", String.raw`${ci("met")}(?:${ci("er")}|${ci("re")})${ci("s")}?`] },
  { id: "in", dim: "length", system: "imperial", toBase: (v) => v * INCH,
    // Bare "in" only before the end or punctuation: "5 in a row" isn't inches.
    names: [String.raw`${ci("inch")}(?:${ci("es")})?`, String.raw`in\.?(?=\s*(?:$|[^\p{L}\p{N}\s]))`, `"`, "″", "”"] },
  { id: "ft", dim: "length", system: "imperial", toBase: (v) => v * 12 * INCH,
    names: [ci("ft"), ci("feet"), ci("foot"), "'", "′", "’"] },
  { id: "yd", dim: "length", system: "imperial", toBase: (v) => v * 36 * INCH,
    names: [ci("yards"), ci("yard"), ci("yds"), ci("yd")] },
  { id: "mi", dim: "length", system: "imperial", toBase: (v) => v * MILE,
    names: [ci("miles"), ci("mile"), ci("mi")] },

  { id: "kg", dim: "weight", system: "kg", toBase: (v) => v,
    names: [ci("kgs"), ci("kg"), String.raw`${ci("kilo")}(?:${ci("gramme")}|${ci("gram")})?${ci("s")}?`] },
  { id: "g", dim: "weight", system: "kg", toBase: (v) => v / 1000,
    names: ["g", String.raw`(?:${ci("gramme")}|${ci("gram")})${ci("s")}?`] },
  { id: "oz", dim: "weight", system: "lb", toBase: (v) => v * LB / 16,
    names: [ci("oz"), String.raw`${ci("ounce")}${ci("s")}?`] },
  { id: "lb", dim: "weight", system: "lb", toBase: (v) => v * LB,
    names: [ci("lbs"), ci("lb"), String.raw`${ci("pound")}${ci("s")}?`] },
  { id: "st", dim: "weight", system: "st", toBase: (v) => v * 14 * LB,
    names: [String.raw`${ci("stone")}${ci("s")}?`, ci("st")] },

  { id: "C", dim: "temperature", system: "C", toBase: (v) => v,
    names: [String.raw`°\s?C`, "℃", String.raw`${ci("degree")}${ci("s")}?\s(?:${ci("celsius")}|${ci("centigrade")})`, ci("celsius")] },
  { id: "F", dim: "temperature", system: "F", toBase: (v) => (v - 32) * 5 / 9,
    names: [String.raw`°\s?F`, "℉", String.raw`${ci("degree")}${ci("s")}?\s${ci("fahrenheit")}`, ci("fahrenheit")] },

  { id: "ml", dim: "volume", system: "metric", toBase: (v) => v / 1000,
    names: [ci("ml"), String.raw`${ci("millilit")}(?:${ci("er")}|${ci("re")})${ci("s")}?`] },
  { id: "l", dim: "volume", system: "metric", toBase: (v) => v,
    names: [String.raw`${ci("lit")}(?:${ci("er")}|${ci("re")})${ci("s")}?`, ci("ltrs"), ci("ltr"), "l", "L"] },
  { id: "pt", dim: "volume", system: (uk) => (uk ? "uk" : "us"), toBase: (v, uk) => v * US_UK.pt[uk ? "uk" : "us"],
    // No "pt": too often means points.
    names: [String.raw`${ci("pint")}${ci("s")}?`] },
  { id: "qt", dim: "volume", system: (uk) => (uk ? "uk" : "us"), toBase: (v, uk) => v * US_UK.qt[uk ? "uk" : "us"],
    names: [String.raw`${ci("quart")}${ci("s")}?`, ci("qts"), ci("qt")] },
  { id: "gal", dim: "volume", system: (uk) => (uk ? "uk" : "us"), toBase: (v, uk) => v * US_UK.gal[uk ? "uk" : "us"],
    names: [String.raw`${ci("gallon")}${ci("s")}?`, ci("gals"), ci("gal")] },
];

// Units whose size differs between the US and the UK.
const US_UK_UNITS = new Set(["floz", "pt", "qt", "gal", "mpg"]);

const BEFORE = String.raw`(?<![\p{L}\p{N}.,])`;
const AFTER = String.raw`(?![\p{L}\p{N}])`;
const unitAlternatives = (ids) => UNITS.filter((u) => ids.includes(u.id)).flatMap((u) => u.names).join("|");

// Simple "<number> <unit>".
const SIMPLE = new RegExp(String.raw`${BEFORE}(${NUM})\s?(${UNITS.flatMap((u) => u.names).join("|")})${AFTER}`, "gu");

// Two-part measurements. The ' and ″ marks may omit the inch sign: 5'11.
const COMPOUNDS = [
  // After "ft", a bare "in" can only be inches ("6 ft 2 in tall").
  { first: "ft", second: "in", re: new RegExp(String.raw`${BEFORE}(${NUM})\s?(?:${ci("ft")}|${ci("feet")}|${ci("foot")})\s?(${NUM})\s?(?:${ci("inch")}(?:${ci("es")})?|in\.?|["″”])${AFTER}`, "gu") },
  { first: "ft", second: "in", re: new RegExp(String.raw`${BEFORE}(\d+)\s?['′’]\s?(\d+(?:\.\d+)?)\s?(?:["″”]|'')?(?![\p{L}\p{N}'])`, "gu") },
  { first: "st", second: "lb", re: new RegExp(String.raw`${BEFORE}(${NUM})\s?(?:${unitAlternatives(["st"])})\s?(${NUM})\s?(?:${unitAlternatives(["lb"])})${AFTER}`, "gu") },
  { first: "lb", second: "oz", re: new RegExp(String.raw`${BEFORE}(${NUM})\s?(?:${unitAlternatives(["lb"])})\s?(${NUM})\s?(?:${unitAlternatives(["oz"])})${AFTER}`, "gu") },
];

// "72 F" / "20C" count only when they are the whole selection.
const BARE_TEMPERATURE = new RegExp(String.raw`^\s*(${NUM})\s?([CF])\s*$`, "u");

const unitById = Object.fromEntries(UNITS.map((u) => [u.id, u]));
const anchored = Object.fromEntries(UNITS.map((u) => [u.id, new RegExp(`^(?:${u.names.join("|")})$`, "u")]));

function identify(unitText) {
  return UNITS.find((u) => anchored[u.id].test(unitText));
}

// Builds a measurement from a source unit and value, or null if it's nonsense.
function measurement(unit, value, uk, start, text) {
  const base = unit.toBase(value, uk);
  if (!Number.isFinite(base)) return null;
  const system = typeof unit.system === "function" ? unit.system(uk) : unit.system;
  const note = US_UK_UNITS.has(unit.id) ? (uk ? "UK" : "US") : null;
  return { start, end: start + text.length, text, dim: unit.dim, unit: unit.id, value: base, system, note };
}

// Finds measurements in `text`.
// `uk`: the page is British, so gallons, pints, fl oz and mpg are imperial.
// `decimalComma`: the page's language writes 2,5 for two and a half.
function findMeasurements(text, { uk = false, decimalComma = false } = {}) {
  const read = (s) => readNumber(s, { decimalComma });

  const bare = text.match(BARE_TEMPERATURE);
  if (bare) {
    const found = measurement(unitById[bare[2]], read(bare[1]), uk, 0, text.trim());
    return found ? [found] : [];
  }

  const candidates = [];
  for (const { first, second, re } of COMPOUNDS) {
    for (const m of text.matchAll(re)) {
      const a = unitById[first];
      const b = unitById[second];
      const value = a.toBase(read(m[1]), uk) + b.toBase(read(m[2]), uk);
      const found = measurement({ ...a, id: `${first}${second}`, toBase: (v) => v }, value, uk, m.index, m[0]);
      if (found) candidates.push(found);
    }
  }
  for (const m of text.matchAll(SIMPLE)) {
    const unit = identify(m[2]);
    if (!unit) continue;
    // "1st", "21st" are ordinals, not stones ("11st" is a weight).
    if (unit.id === "st" && !/\s/.test(m[0]) && /(^|[^1])1$/.test(m[1])) continue;
    const found = measurement(unit, read(m[1]), uk, m.index, m[0]);
    if (found) candidates.push(found);
  }

  // Keep the longest match at each place; drop overlaps.
  candidates.sort((x, y) => x.start - y.start || y.end - x.end);
  const result = [];
  for (const c of candidates) {
    if (!result.length || c.start >= result[result.length - 1].end) result.push(c);
  }
  return result;
}

// --- Converting ---

function formatter(locale, options) {
  return new Intl.NumberFormat(locale, options);
}

// Three significant digits below 1000, whole numbers above.
function nice(n, locale) {
  return Math.abs(n) >= 1000
    ? formatter(locale, { maximumFractionDigits: 0 }).format(n)
    : formatter(locale, { maximumSignificantDigits: 3 }).format(n);
}

const fixed = (n, digits, locale) => formatter(locale, { maximumFractionDigits: digits }).format(n);

// Each returns { text, unit } for a value in base units.
const FORMATS = {
  length: {
    metric(m, l) {
      if (Math.abs(m) < 0.01) return { text: `${nice(m * 1000, l)} mm`, unit: "mm" };
      if (Math.abs(m) < 3) return { text: `${nice(m * 100, l)} cm`, unit: "cm" };
      if (Math.abs(m) < 1000) return { text: `${nice(m, l)} m`, unit: "m" };
      return { text: `${nice(m / 1000, l)} km`, unit: "km" };
    },
    imperial(m, l) {
      const inches = m / INCH;
      if (Math.abs(inches) < 12) return { text: `${nice(inches, l)} in`, unit: "in" };
      if (Math.abs(inches) < 120) {
        const total = Math.round(inches);
        const ft = Math.floor(total / 12);
        const rest = total % 12;
        return { text: rest ? `${ft} ft ${rest} in` : `${ft} ft`, unit: "ftin" };
      }
      const feet = inches / 12;
      if (Math.abs(feet) < 1000) return { text: `${fixed(feet, 0, l)} ft`, unit: "ft" };
      return { text: `${nice(m / MILE, l)} mi`, unit: "mi" };
    },
  },
  weight: {
    kg(kg, l) {
      if (Math.abs(kg) < 1) return { text: `${nice(kg * 1000, l)} g`, unit: "g" };
      return { text: `${nice(kg, l)} kg`, unit: "kg" };
    },
    lb(kg, l) {
      const lb = kg / LB;
      if (Math.abs(lb) < 1) return { text: `${nice(lb * 16, l)} oz`, unit: "oz" };
      return { text: `${nice(lb, l)} lb`, unit: "lb" };
    },
    st(kg, l) {
      const lb = kg / LB;
      if (Math.abs(lb) < 14) return FORMATS.weight.lb(kg, l);
      let st = Math.floor(lb / 14);
      let rest = Math.round(lb - st * 14);
      if (rest === 14) { st += 1; rest = 0; }
      return { text: rest ? `${st} st ${rest} lb` : `${st} st`, unit: "stlb" };
    },
  },
  temperature: {
    C: (c, l) => ({ text: `${fixed(c, 1, l)} °C`, unit: "C" }),
    F: (c, l) => ({ text: `${fixed(c * 9 / 5 + 32, 1, l)} °F`, unit: "F" }),
  },
  volume: {
    metric(litres, l) {
      if (Math.abs(litres) < 1) return { text: `${nice(litres * 1000, l)} ml`, unit: "ml" };
      return { text: `${nice(litres, l)} L`, unit: "l" };
    },
    us: (litres, l) => usUkVolume(litres, "us", l),
    uk: (litres, l) => usUkVolume(litres, "uk", l),
  },
  speed: {
    kmh: (kmh, l) => ({ text: `${fixed(kmh, 0, l)} km/h`, unit: "kmh" }),
    mph: (kmh, l) => ({ text: `${fixed(kmh * 1000 / MILE, 0, l)} mph`, unit: "mph" }),
  },
  fuel: {
    l100km: (v, l) => ({ text: `${fixed(v, 1, l)} L/100 km`, unit: "l100" }),
    kml: (v, l) => ({ text: `${fixed(100 / v, 1, l)} km/L`, unit: "kml" }),
    mpg_us: (v, l) => ({ text: `${fixed(MPG_TO_L100.us / v, 1, l)} mpg (US)`, unit: "mpg_us" }),
    mpg_uk: (v, l) => ({ text: `${fixed(MPG_TO_L100.uk / v, 1, l)} mpg (UK)`, unit: "mpg_uk" }),
  },
};

function usUkVolume(litres, region, l) {
  const label = region.toUpperCase();
  const gal = litres / US_UK.gal[region];
  if (Math.abs(gal) < 0.25) return { text: `${nice(litres / US_UK.floz[region], l)} ${label} fl oz`, unit: `floz_${region}` };
  return { text: `${nice(gal, l)} ${label} gal`, unit: `gal_${region}` };
}

// Converts a measurement to the preferred unit for its kind. Returns the
// text to show, or null when it's already in the preferred unit.
// `prefs`: { length, weight, temperature, volume, speed, fuel }.
function convertMeasurement(found, prefs, locale) {
  const target = prefs[found.dim];
  if (found.system === target) return null;
  const format = FORMATS[found.dim][target];
  if (!format) return null;
  const out = format(found.value, locale);
  // e.g. "8 oz" with the "st & lb" preference stays "8 oz".
  if (out.unit === found.unit) return null;
  return out.text;
}

if (typeof module !== "undefined") {
  module.exports = { findMeasurements, convertMeasurement };
}
