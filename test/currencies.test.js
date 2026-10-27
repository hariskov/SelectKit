const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./helpers/load.js");
const { findPrices, convertPrice, formatMoney, BGN_PER_EUR } = loadScripts(["lib/patterns.js", "lib/numbers.js", "lib/currency-data.js", "lib/currencies.js"]);

// Fixed test rates (per 1 EUR). The extension itself always uses live rates.
const RATES = { USD: 1.12, GBP: 0.85, JPY: 165, CHF: 0.94, RON: 5.35, PLN: 4.3, CZK: 25, TRY: 38,
  INR: 95, KRW: 1500, BRL: 6, UAH: 46, CAD: 1.55, AUD: 1.7, NOK: 11.6, SEK: 11.2, MDL: 20, VND: 29000, AED: 4.1 };

// "<amount> <code>" of the first price found.
function first(text, page) {
  const [p] = findPrices(text, page);
  return p ? `${p.amount} ${p.codes[0]}` : null;
}

test("symbols before and after the number", () => {
  assert.equal(first("$19.99"), "19.99 USD");
  assert.equal(first("£5"), "5 GBP");
  assert.equal(first("¥1,200"), "1200 JPY");
  assert.equal(first("€ 5"), "5 EUR");
  assert.equal(first("5€"), "5 EUR");
  assert.equal(first("₹1,23,456"), "123456 INR");
  assert.equal(first("₩50,000"), "50000 KRW");
  assert.equal(first("₺250"), "250 TRY");
  assert.equal(first("R$ 99,90"), "99.9 BRL");
  assert.equal(first("150 zł"), "150 PLN");
  assert.equal(first("299 Kč"), "299 CZK");
  assert.equal(first("US$ 5"), "5 USD");
  assert.equal(first("CA$5"), "5 CAD");
});

test("ISO codes before and after", () => {
  assert.equal(first("USD 40"), "40 USD");
  assert.equal(first("40 USD"), "40 USD");
  assert.equal(first("CHF 12.50"), "12.5 CHF");
  assert.equal(first("VND 250000"), "250000 VND");
  assert.equal(first("40 TRY"), "40 TRY");
  assert.equal(first("AED 100"), "100 AED");
});

test("symbol, name and code mean the same currency", () => {
  for (const t of ["50 RON", "50 lei", "50 Lei", "50 LEI", "lei 50", "50lei"]) assert.equal(first(t), "50 RON", t);
  for (const t of ["12 BGN", "12 лв", "12лв.", "12 лева", "12 ЛВ", "12 lv"]) assert.equal(first(t), "12 BGN", t);
  for (const t of ["100 UAH", "100 грн", "₴100"]) assert.equal(first(t), "100 UAH", t);
  assert.equal(first("250 TL"), "250 TRY");
  assert.equal(first("100 евро"), "100 EUR");
});

test("lower-case codes only when the selection is just the price", () => {
  assert.equal(first("ron 50"), "50 RON");
  assert.equal(first("50ron"), "50 RON");
  assert.equal(first("TRY 40"), "40 TRY");
  assert.equal(first("try 40"), null);
  assert.equal(first("top 10"), null);
  assert.equal(first("give it 5 try more"), null);
  assert.equal(first("we have 10 cup cakes"), null);
});

test("ISO codes that are English words never come before the number", () => {
  for (const text of ["TOP 10 LIST", "ALL 5 PLAYERS", "CUP 3 FINAL", "MAD 4 IT", "PEN 2 PAPER", "SEND SOS 1 TIME"]) {
    assert.deepEqual(findPrices(text), [], text);
  }
  assert.equal(first("costs 40 TRY"), "40 TRY");
  assert.equal(first("costs 500 ALL"), "500 ALL");
});

test("number formats", () => {
  assert.equal(first("1.299,00 лв"), "1299 BGN");
  assert.equal(first("12,50 лв."), "12.5 BGN");
  assert.equal(first("$1,234.56"), "1234.56 USD");
  assert.equal(first("1.234,56 €"), "1234.56 EUR");
  assert.equal(first("1 234,56 €"), "1234.56 EUR");
  assert.equal(first("CHF 1'234.56"), "1234.56 CHF");
  assert.equal(first("$5k"), "5000 USD");
  assert.equal(first("$1.2 million"), "1200000 USD");
});

test("ambiguous symbols: popular first, page region wins", () => {
  assert.deepEqual(findPrices("$20")[0].codes.slice(0, 3), ["USD", "CAD", "AUD"]);
  assert.equal(first("$20", { region: "CA" }), "20 CAD");
  assert.equal(first("$20", { region: "AU" }), "20 AUD");
  assert.equal(first("$20", { region: "MX" }), "20 MXN");
  assert.equal(first("100 kr"), "100 SEK");
  assert.equal(first("100 kr", { region: "NO" }), "100 NOK");
  assert.equal(first("100 kr.", { region: "DK" }), "100 DKK");
  assert.equal(first("Rs 500", { region: "PK" }), "500 PKR");
  assert.equal(first("50 lei", { region: "MD" }), "50 MDL");
  assert.equal(first("¥500", { region: "CN" }), "500 CNY");
});

test("symbol is recorded, ISO codes have none", () => {
  assert.equal(findPrices("50 lei")[0].symbol, "lei");
  assert.equal(findPrices("50 RON")[0].symbol, null);
});

test("not prices", () => {
  for (const text of [
    "TL;DR", "lv 5 armor", "Ft. Worth", "5 L of water", "5 KM away", "100% sure",
    "version 2.0", "5 friends", "Room 101", "the 1990s",
  ]) {
    assert.deepEqual(findPrices(text), [], text);
  }
});

test("several prices in a sentence", () => {
  const found = findPrices("It costs $20 here, 18 € in Paris and 95 lei in Bucharest.");
  assert.deepEqual(found.map((p) => `${p.amount} ${p.codes[0]}`), ["20 USD", "18 EUR", "95 RON"]);
});

test("conversion through EUR, with the fixed BGN rate", () => {
  assert.equal(convertPrice(10, "EUR", "EUR", RATES), null);
  assert.ok(Math.abs(convertPrice(112, "USD", "EUR", RATES) - 100) < 1e-9);
  assert.equal(convertPrice(100, "EUR", "RON", RATES), 535);
  assert.equal(convertPrice(BGN_PER_EUR, "BGN", "EUR", {}), 1);
  assert.equal(convertPrice(10, "EUR", "BGN", {}), 19.5583);
  assert.ok(Math.abs(convertPrice(38, "TRY", "USD", RATES) - 1.12) < 1e-9);
  assert.equal(convertPrice(5, "XYZ", "EUR", RATES), null);
  assert.equal(convertPrice(5, "USD", "EUR", null), null);
});

test("formatMoney", () => {
  assert.equal(formatMoney(10.05, "EUR", "en"), "€10.05");
  assert.equal(formatMoney(1234.5, "EUR", "en"), "€1,235");
  assert.equal(formatMoney(19.5583, "BGN", "en").replace(/\s/g, " "), "BGN 19.56");
});
