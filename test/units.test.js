const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./helpers/load.js");
const { findMeasurements, convertMeasurement } = loadScripts(["lib/patterns.js", "lib/numbers.js", "lib/units.js"]);

const METRIC = { length: "metric", weight: "kg", temperature: "C", volume: "metric", speed: "kmh", fuel: "l100km" };
const US = { length: "imperial", weight: "lb", temperature: "F", volume: "us", speed: "mph", fuel: "mpg_us" };
const UK = { length: "imperial", weight: "st", temperature: "C", volume: "uk", speed: "mph", fuel: "mpg_uk" };

// Converts every measurement in `text`; returns the shown results.
function convert(text, prefs = METRIC, page = {}) {
  return findMeasurements(text, page)
    .map((m) => convertMeasurement(m, prefs, "en"))
    .filter(Boolean);
}
const one = (text, prefs, page) => convert(text, prefs, page)[0] ?? null;

test("length to metric", () => {
  assert.equal(one("5 ft 11 in"), "180 cm");
  assert.equal(one("5 feet 11 inches"), "180 cm");
  assert.equal(one(`6'2"`), "188 cm");
  assert.equal(one("5'11"), "180 cm");
  assert.equal(one("6′2″"), "188 cm");
  assert.equal(one("3 miles"), "4.83 km");
  assert.equal(one("26.2 mi"), "42.2 km");
  assert.equal(one("12 inches"), "30.5 cm");
  assert.equal(one(`a 27" monitor`), "68.6 cm");
  assert.equal(one("10 yd"), "9.14 m");
  assert.equal(one("1,000 ft"), "305 m");
});

test("weight to metric", () => {
  assert.equal(one("180 lb"), "81.6 kg");
  assert.equal(one("180 lbs"), "81.6 kg");
  assert.equal(one("180 pounds"), "81.6 kg");
  assert.equal(one("11 st 4 lb"), "71.7 kg");
  assert.equal(one("11st 4lb"), "71.7 kg");
  assert.equal(one("8 oz"), "227 g");
  assert.equal(one("1 lb 4 oz"), "567 g");
});

test("temperature", () => {
  assert.equal(one("72°F"), "22.2 °C");
  assert.equal(one("72 °F"), "22.2 °C");
  assert.equal(one("72 F"), "22.2 °C");
  assert.equal(one("-40 °F"), "-40 °C");
  assert.equal(one("it was 100 degrees Fahrenheit"), "37.8 °C");
  assert.equal(one("20 °C", US), "68 °F");
  assert.equal(one("20C", US), "68 °F");
});

test("volume and speed", () => {
  assert.equal(one("1 gallon"), "3.79 L");
  assert.equal(one("1 gallon", METRIC, { uk: true }), "4.55 L");
  assert.equal(one("12 fl oz"), "355 ml");
  assert.equal(one("2 pints"), "946 ml");
  assert.equal(one("2 pints", METRIC, { uk: true }), "1.14 L");
  assert.equal(one("60 mph"), "97 km/h");
  assert.equal(one("60 miles per hour"), "97 km/h");
  assert.equal(one("100 km/h", US), "62 mph");
});

test("fuel economy", () => {
  assert.equal(one("35 mpg"), "6.7 L/100 km");
  assert.equal(one("35 mpg", METRIC, { uk: true }), "8.1 L/100 km");
  assert.equal(one("35 miles per gallon"), "6.7 L/100 km");
  assert.equal(one("6.7 L/100 km", US), "35.1 mpg (US)");
  assert.equal(one("5 l/100km", UK), "56.5 mpg (UK)");
  assert.equal(one("5 L/100 km", { ...METRIC, fuel: "kml" }), "20 km/L");
  assert.equal(one("20 km/L"), "5 L/100 km");
  assert.equal(one("35 mpg", US), null);
  assert.equal(one("35 mpg", UK), "42 mpg (UK)");
});

test("US / UK note on the measurement", () => {
  const [m] = findMeasurements("35 mpg");
  assert.equal(m.note, "US");
  const [uk] = findMeasurements("35 mpg", { uk: true });
  assert.equal(uk.note, "UK");
  assert.equal(findMeasurements("5 km")[0].note, null);
});

test("other preferences", () => {
  assert.equal(one("180 cm", US), "5 ft 11 in");
  assert.equal(one("2 m", US), "6 ft 7 in");
  assert.equal(one("5 km", US), "3.11 mi");
  assert.equal(one("30 cm", US), "11.8 in");
  assert.equal(one("80 kg", UK), "12 st 8 lb");
  assert.equal(one("80 kg", US), "176 lb");
  assert.equal(one("250 g", US), "8.82 oz");
  assert.equal(one("180 lb", UK), "12 st 12 lb");
  assert.equal(one("11 st 4 lb", US), "158 lb");
  assert.equal(one("3.79 L", US), "1 US gal");
  assert.equal(one("500 ml", UK), "17.6 UK fl oz");
  assert.equal(one("1 gallon", UK), "0.833 UK gal");
  assert.equal(one("1 gallon", US, { uk: true }), "1.2 US gal");
  assert.equal(one("1 gallon", US), null);
});

test("values already in the preferred unit show nothing", () => {
  assert.equal(one("180 cm"), null);
  assert.equal(one("5 L/100 km"), null);
  assert.equal(one("20 °C"), null);
  assert.equal(one("80 kg"), null);
  assert.equal(one("6 ft", US), null);
  assert.equal(one("8 oz", UK), null);
});

test("ordinary text is not a measurement", () => {
  for (const text of [
    "5 friends", "in 2024", "5 in a row", "21st century", "the 1st place",
    "the 90's", "5G network", "10 minutes", "3 mins", "25 pts", "Room 5",
    "version 2.0", "A4 paper", "100%",
  ]) {
    assert.deepEqual(findMeasurements(text), [], text);
  }
});

test("bare C/F only as the whole selection", () => {
  assert.equal(one("Grade 5 C students"), null);
  assert.equal(one("Vitamin C"), null);
  assert.equal(one("72 F"), "22.2 °C");
});

test("several measurements in one sentence", () => {
  assert.deepEqual(
    convert("He is 6 ft 2 in tall, weighs 180 lb and ran 3 miles."),
    ["188 cm", "81.6 kg", "4.83 km"],
  );
});

test("number formats", () => {
  assert.equal(one("2,5 km", US), "1.55 mi");
  assert.equal(one("1.500 km", US, { decimalComma: true }), "932 mi");
  assert.equal(one("1,500 ft"), "457 m");
});
