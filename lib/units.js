const INCH = 0.0254;
const MILE = 1609.344;
const POUND = 0.45359237;
const US_UK_VOLUME = {
  floz: { us: 0.0295735295625, uk: 0.0284130625 },
  pt: { us: 0.473176473, uk: 0.56826125 },
  qt: { us: 0.946352946, uk: 1.1365225 },
  gal: { us: 3.785411784, uk: 4.54609 },
};
const MPG_TO_L100 = { us: 235.214583, uk: 282.480936 };
const US_UK = { us: "us", uk: "uk" };

const word = anyCase;
const metreWord = (prefix) => String.raw`${word(prefix)}(?:${word("er")}|${word("re")})${word("s")}?`;
const plural = (singular) => `${word(singular)}${word("s")}?`;

// Base units: m, kg, l, km/h, °C, l/100 km. `factor` converts linearly
// (per region for US/UK units); `toBase` handles the rest. A `system`
// object means the unit's size depends on the region. Names that are a
// prefix of another name come after it ("km/h" before "km").
const UNITS = [
  { id: "l100", dim: "fuel", system: "l100km", factor: 1,
    names: [String.raw`[lL]\s?/\s?100\s?${word("km")}`, String.raw`${metreWord("lit")}\s${word("per")}\s100\s?${word("km")}`] },
  { id: "kml", dim: "fuel", system: "kml", toBase: (v) => 100 / v,
    names: [String.raw`${word("km")}\s?/\s?[lL]`, word("kmpl")] },
  { id: "mpg", dim: "fuel", system: { us: "mpg_us", uk: "mpg_uk" }, toBase: (v, region) => MPG_TO_L100[region] / v,
    names: [word("mpg"), String.raw`${plural("mile")}\s${word("per")}\s${word("gallon")}`] },
  { id: "kmh", dim: "speed", system: "kmh", factor: 1,
    names: [String.raw`${word("km")}\s?/\s?${word("h")}${word("r")}?`, word("kmh"), word("kph"), String.raw`${metreWord("kilomet")}\s${word("per")}\s${word("hour")}`] },
  { id: "mph", dim: "speed", system: "mph", factor: MILE / 1000,
    names: [word("mph"), String.raw`${word("mi")}\s?/\s?${word("h")}`, String.raw`${plural("mile")}\s${word("per")}\s${word("hour")}`] },
  { id: "floz", dim: "volume", system: US_UK, factor: US_UK_VOLUME.floz,
    names: [String.raw`${word("fl")}\.?\s?${word("oz")}`, String.raw`${word("fluid")}\s${plural("ounce")}`] },

  { id: "mm", dim: "length", system: "metric", factor: 0.001, names: [word("mm"), metreWord("millimet")] },
  { id: "cm", dim: "length", system: "metric", factor: 0.01, names: [word("cm"), metreWord("centimet")] },
  { id: "km", dim: "length", system: "metric", factor: 1000, names: [word("kms"), word("km"), metreWord("kilomet")] },
  { id: "m", dim: "length", system: "metric", factor: 1, names: ["m", metreWord("met")] },
  // A bare "in" only before the end or punctuation: "5 in a row" isn't inches.
  { id: "in", dim: "length", system: "imperial", factor: INCH,
    names: [String.raw`${word("inch")}(?:${word("es")})?`, String.raw`in\.?(?=\s*(?:$|[^\p{L}\p{N}\s]))`, `"`, "″", "”"] },
  { id: "ft", dim: "length", system: "imperial", factor: 12 * INCH, names: [word("ft"), word("feet"), word("foot"), "'", "′", "’"] },
  { id: "yd", dim: "length", system: "imperial", factor: 36 * INCH, names: [plural("yard"), word("yds"), word("yd")] },
  { id: "mi", dim: "length", system: "imperial", factor: MILE, names: [plural("mile"), word("mi")] },

  { id: "kg", dim: "weight", system: "kg", factor: 1,
    names: [word("kgs"), word("kg"), String.raw`${word("kilo")}(?:${word("gramme")}|${word("gram")})?${word("s")}?`] },
  { id: "g", dim: "weight", system: "kg", factor: 0.001, names: ["g", String.raw`(?:${word("gramme")}|${word("gram")})${word("s")}?`] },
  { id: "oz", dim: "weight", system: "lb", factor: POUND / 16, names: [word("oz"), plural("ounce")] },
  { id: "lb", dim: "weight", system: "lb", factor: POUND, names: [word("lbs"), word("lb"), plural("pound")] },
  { id: "st", dim: "weight", system: "st", factor: 14 * POUND, names: [plural("stone"), word("st")] },

  { id: "C", dim: "temperature", system: "C", factor: 1,
    names: [String.raw`°\s?C`, "℃", String.raw`${plural("degree")}\s(?:${word("celsius")}|${word("centigrade")})`, word("celsius")] },
  { id: "F", dim: "temperature", system: "F", toBase: (v) => (v - 32) * 5 / 9,
    names: [String.raw`°\s?F`, "℉", String.raw`${plural("degree")}\s${word("fahrenheit")}`, word("fahrenheit")] },

  { id: "ml", dim: "volume", system: "metric", factor: 0.001, names: [word("ml"), metreWord("millilit")] },
  { id: "l", dim: "volume", system: "metric", factor: 1, names: [metreWord("lit"), word("ltrs"), word("ltr"), "l", "L"] },
  // No "pt": it usually means points.
  { id: "pt", dim: "volume", system: US_UK, factor: US_UK_VOLUME.pt, names: [plural("pint")] },
  { id: "qt", dim: "volume", system: US_UK, factor: US_UK_VOLUME.qt, names: [plural("quart"), word("qts"), word("qt")] },
  { id: "gal", dim: "volume", system: US_UK, factor: US_UK_VOLUME.gal, names: [plural("gallon"), word("gals"), word("gal")] },
];

const UNIT_BY_ID = Object.fromEntries(UNITS.map((unit) => [unit.id, unit]));
const UNIT_NAME_PATTERNS = UNITS.map((unit) => ({ unit, re: new RegExp(`^(?:${unit.names.join("|")})$`, "u") }));
const unitNames = (...ids) => ids.flatMap((id) => UNIT_BY_ID[id].names).join("|");

const SIMPLE_MEASUREMENT = new RegExp(
  String.raw`${NO_NUMBER_BEFORE}(${NUMBER_PATTERN})\s?(${UNITS.flatMap((u) => u.names).join("|")})${NO_WORD_AFTER}`, "gu");

const TWO_PART_MEASUREMENTS = [
  // After "ft" a bare "in" can only be inches: "6 ft 2 in tall".
  { first: "ft", second: "in", re: new RegExp(String.raw`${NO_NUMBER_BEFORE}(${NUMBER_PATTERN})\s?(?:${word("ft")}|${word("feet")}|${word("foot")})\s?(${NUMBER_PATTERN})\s?(?:${word("inch")}(?:${word("es")})?|in\.?|["″”])${NO_WORD_AFTER}`, "gu") },
  { first: "ft", second: "in", re: new RegExp(String.raw`${NO_NUMBER_BEFORE}(\d+)\s?['′’]\s?(\d+(?:\.\d+)?)\s?(?:["″”]|'')?(?![\p{L}\p{N}'])`, "gu") },
  { first: "st", second: "lb", re: new RegExp(String.raw`${NO_NUMBER_BEFORE}(${NUMBER_PATTERN})\s?(?:${unitNames("st")})\s?(${NUMBER_PATTERN})\s?(?:${unitNames("lb")})${NO_WORD_AFTER}`, "gu") },
  { first: "lb", second: "oz", re: new RegExp(String.raw`${NO_NUMBER_BEFORE}(${NUMBER_PATTERN})\s?(?:${unitNames("lb")})\s?(${NUMBER_PATTERN})\s?(?:${unitNames("oz")})${NO_WORD_AFTER}`, "gu") },
];

// "72 F" and "20C" only count as the whole selection ("Vitamin C").
const BARE_TEMPERATURE = new RegExp(String.raw`^\s*(${NUMBER_PATTERN})\s?([CF])\s*$`, "u");

function toBase(unit, value, region) {
  if (unit.toBase) return unit.toBase(value, region);
  return value * (typeof unit.factor === "number" ? unit.factor : unit.factor[region]);
}

function measurement(unit, id, base, region, start, text) {
  if (!Number.isFinite(base)) return null;
  const regional = typeof unit.system === "object";
  return {
    start, end: start + text.length, text, dim: unit.dim, unit: id, value: base,
    system: regional ? unit.system[region] : unit.system,
    note: regional ? region.toUpperCase() : null,
  };
}

// `uk`: the text is British, so gallons, pints, fl oz and mpg are imperial.
function findMeasurements(text, { uk = false, decimalComma = false } = {}) {
  const region = uk ? "uk" : "us";
  const read = (written) => parseNumber(written, { decimalComma });

  const bare = text.match(BARE_TEMPERATURE);
  if (bare) {
    const unit = UNIT_BY_ID[bare[2]];
    const found = measurement(unit, unit.id, toBase(unit, read(bare[1]), region), region, 0, text.trim());
    return found ? [found] : [];
  }

  const found = [];
  for (const { first, second, re } of TWO_PART_MEASUREMENTS) {
    for (const m of text.matchAll(re)) {
      const base = toBase(UNIT_BY_ID[first], read(m[1]), region) + toBase(UNIT_BY_ID[second], read(m[2]), region);
      found.push(measurement(UNIT_BY_ID[first], first + second, base, region, m.index, m[0]));
    }
  }
  for (const m of text.matchAll(SIMPLE_MEASUREMENT)) {
    const unit = UNIT_NAME_PATTERNS.find(({ re }) => re.test(m[2]))?.unit;
    // "1st" and "21st" are ordinals; "11st" is a weight.
    const isOrdinal = unit?.id === "st" && !/\s/.test(m[0]) && /(^|[^1])1$/.test(m[1]);
    if (unit && !isOrdinal) found.push(measurement(unit, unit.id, toBase(unit, read(m[1]), region), region, m.index, m[0]));
  }
  return keepLongest(found.filter(Boolean));
}

const significant = (n, locale) => (Math.abs(n) >= 1000
  ? numberFormat(locale, { maximumFractionDigits: 0 })
  : numberFormat(locale, { maximumSignificantDigits: 3 })).format(n);
const fixed = (n, digits, locale) => numberFormat(locale, { maximumFractionDigits: digits }).format(n);

function usUkVolume(litres, region, locale) {
  const label = region.toUpperCase();
  const gallons = litres / US_UK_VOLUME.gal[region];
  if (Math.abs(gallons) < 0.25) {
    return { text: `${significant(litres / US_UK_VOLUME.floz[region], locale)} ${label} fl oz`, unit: `floz_${region}` };
  }
  return { text: `${significant(gallons, locale)} ${label} gal`, unit: `gal_${region}` };
}

const UNIT_FORMATS = {
  length: {
    metric(m, locale) {
      if (Math.abs(m) < 0.01) return { text: `${significant(m * 1000, locale)} mm`, unit: "mm" };
      if (Math.abs(m) < 3) return { text: `${significant(m * 100, locale)} cm`, unit: "cm" };
      if (Math.abs(m) < 1000) return { text: `${significant(m, locale)} m`, unit: "m" };
      return { text: `${significant(m / 1000, locale)} km`, unit: "km" };
    },
    imperial(m, locale) {
      const inches = m / INCH;
      if (Math.abs(inches) < 12) return { text: `${significant(inches, locale)} in`, unit: "in" };
      if (Math.abs(inches) < 120) {
        const total = Math.round(inches);
        const feet = Math.floor(total / 12);
        const rest = total % 12;
        return { text: rest ? `${feet} ft ${rest} in` : `${feet} ft`, unit: "ftin" };
      }
      if (Math.abs(inches) < 12000) return { text: `${fixed(inches / 12, 0, locale)} ft`, unit: "ft" };
      return { text: `${significant(m / MILE, locale)} mi`, unit: "mi" };
    },
  },
  weight: {
    kg(kg, locale) {
      if (Math.abs(kg) < 1) return { text: `${significant(kg * 1000, locale)} g`, unit: "g" };
      return { text: `${significant(kg, locale)} kg`, unit: "kg" };
    },
    lb(kg, locale) {
      const pounds = kg / POUND;
      if (Math.abs(pounds) < 1) return { text: `${significant(pounds * 16, locale)} oz`, unit: "oz" };
      return { text: `${significant(pounds, locale)} lb`, unit: "lb" };
    },
    st(kg, locale) {
      const pounds = kg / POUND;
      if (Math.abs(pounds) < 14) return UNIT_FORMATS.weight.lb(kg, locale);
      let stones = Math.floor(pounds / 14);
      let rest = Math.round(pounds - stones * 14);
      if (rest === 14) {
        stones += 1;
        rest = 0;
      }
      return { text: rest ? `${stones} st ${rest} lb` : `${stones} st`, unit: "stlb" };
    },
  },
  temperature: {
    C: (c, locale) => ({ text: `${fixed(c, 1, locale)} °C`, unit: "C" }),
    F: (c, locale) => ({ text: `${fixed(c * 9 / 5 + 32, 1, locale)} °F`, unit: "F" }),
  },
  volume: {
    metric(litres, locale) {
      if (Math.abs(litres) < 1) return { text: `${significant(litres * 1000, locale)} ml`, unit: "ml" };
      return { text: `${significant(litres, locale)} L`, unit: "l" };
    },
    us: (litres, locale) => usUkVolume(litres, "us", locale),
    uk: (litres, locale) => usUkVolume(litres, "uk", locale),
  },
  speed: {
    kmh: (kmh, locale) => ({ text: `${fixed(kmh, 0, locale)} km/h`, unit: "kmh" }),
    mph: (kmh, locale) => ({ text: `${fixed(kmh * 1000 / MILE, 0, locale)} mph`, unit: "mph" }),
  },
  fuel: {
    l100km: (l100, locale) => ({ text: `${fixed(l100, 1, locale)} L/100 km`, unit: "l100" }),
    kml: (l100, locale) => ({ text: `${fixed(100 / l100, 1, locale)} km/L`, unit: "kml" }),
    mpg_us: (l100, locale) => ({ text: `${fixed(MPG_TO_L100.us / l100, 1, locale)} mpg (US)`, unit: "mpg_us" }),
    mpg_uk: (l100, locale) => ({ text: `${fixed(MPG_TO_L100.uk / l100, 1, locale)} mpg (UK)`, unit: "mpg_uk" }),
  },
};

// Null when the measurement is already in the preferred unit, e.g. "8 oz"
// with the stones preference.
function convertMeasurement(found, prefs, locale) {
  const format = UNIT_FORMATS[found.dim][prefs[found.dim]];
  if (!format || found.system === prefs[found.dim]) return null;
  const out = format(found.value, locale);
  return out.unit === found.unit ? null : out.text;
}
