const test = require("node:test");
const assert = require("node:assert/strict");
const { NUMBER_PATTERN, parseNumber, usesDecimalComma } = require("../lib/numbers.js");

test("plain and negative numbers", () => {
  assert.equal(parseNumber("42"), 42);
  assert.equal(parseNumber("-40"), -40);
  assert.equal(parseNumber("−40"), -40);
  assert.equal(parseNumber("12.50"), 12.5);
  assert.equal(parseNumber(".5"), 0.5);
});

test("thousands separators", () => {
  assert.equal(parseNumber("1,234"), 1234);
  assert.equal(parseNumber("1,234.56"), 1234.56);
  assert.equal(parseNumber("1.234,56"), 1234.56);
  assert.equal(parseNumber("1 234,56"), 1234.56);
  assert.equal(parseNumber("1 234,56"), 1234.56);
  assert.equal(parseNumber("1'234.56"), 1234.56);
  assert.equal(parseNumber("1,234,567"), 1234567);
  assert.equal(parseNumber("1.234.567"), 1234567);
  assert.equal(parseNumber("1,23,456"), 123456);
});

test("decimal comma", () => {
  assert.equal(parseNumber("2,5"), 2.5);
  assert.equal(parseNumber("12,50"), 12.5);
});

test("ambiguous 1.500 / 1,500 follows the page language", () => {
  assert.equal(parseNumber("1.500"), 1.5);
  assert.equal(parseNumber("1,500"), 1500);
  assert.equal(parseNumber("1.500", { decimalComma: true }), 1500);
  assert.equal(parseNumber("1,500", { decimalComma: true }), 1.5);
});

test("NUMBER_PATTERN finds whole written numbers", () => {
  const find = (text) => text.match(new RegExp(NUMBER_PATTERN, "u"))[0];
  assert.equal(find("costs 1,234.56 today"), "1,234.56");
  assert.equal(find("1.234,56 лв"), "1.234,56");
  assert.equal(find("₹1,23,456"), "1,23,456");
  assert.equal(find("-40 °F"), "-40");
  assert.equal(find("26.2 mi"), "26.2");
});

test("usesDecimalComma", () => {
  assert.equal(usesDecimalComma("de"), true);
  assert.equal(usesDecimalComma("bg"), true);
  assert.equal(usesDecimalComma("en-US"), false);
  assert.equal(usesDecimalComma(""), false);
});
