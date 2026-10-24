// Finding prices in text and converting them. Pure logic: content scripts get
// the CLDR data and number helpers as globals, the Node tests through require.

const money = typeof module !== "undefined"
  ? { ...require("./currency-data.js"), ...require("./numbers.js") }
  : { CURRENCY_CODES, CURRENCY_SYMBOLS, NUMBER_PATTERN, parseNumber };

// 1 EUR in BGN: fixed since Bulgaria adopted the euro on 2026-01-01.
const BGN_PER_EUR = 1.95583;

// Everyday names CLDR doesn't have. Case-insensitive unless `exact`.
// `suffix`: only after the number ("5 lv"; "lv 5 armor" isn't a price).
const EXTRA_NAMES = [
  { names: ["лв", "лв.", "лева", "лев"], codes: ["BGN"] },
  { names: ["lv"], codes: ["BGN"], suffix: true },
  { names: ["lei", "leu"], codes: ["RON", "MDL"] },
  { names: ["euro", "euros", "евро"], codes: ["EUR"], suffix: true },
  { names: ["dollar", "dollars", "долар", "долара"], codes: money.CURRENCY_SYMBOLS.$, suffix: true },
  { names: ["грн", "грн.", "гривень", "гривні", "гривни"], codes: ["UAH"] },
  { names: ["руб", "руб.", "рублей", "рубля"], codes: ["RUB"] },
  { names: ["дин", "дин.", "din", "din."], codes: ["RSD"] },
  { names: ["ден", "ден."], codes: ["MKD"] },
  { names: ["TL"], codes: ["TRY"], suffix: true, exact: true },
  { names: ["Fr.", "SFr."], codes: ["CHF"], exact: true },
  { names: ["円", "yen"], codes: ["JPY"], suffix: true },
  { names: ["元", "yuan"], codes: ["CNY"], suffix: true },
  { names: ["RMB"], codes: ["CNY"], exact: true },
  { names: ["원", "won"], codes: ["KRW"], suffix: true },
  { names: ["zloty", "zlotys", "złotych"], codes: ["PLN"], suffix: true },
  { names: ["forint"], codes: ["HUF"], suffix: true },
  { names: ["rupee", "rupees"], codes: money.CURRENCY_SYMBOLS.Rs, suffix: true },
];

// When a symbol fits several currencies and the page doesn't settle it.
const POPULAR = [
  "USD", "EUR", "GBP", "JPY", "CNY", "CAD", "AUD", "CHF", "INR", "KRW", "SEK", "NOK", "DKK",
  "MXN", "NZD", "SGD", "HKD", "RON", "PKR", "TWD", "BRL", "ISK", "LKR", "NPR",
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Case-insensitive in any script: "лв" -> "[лЛ][вВ]".
const anyCase = (s) => [...s].map((c) => (c.toLowerCase() === c.toUpperCase() ? escapeRe(c) : `[${c.toLowerCase()}${c.toUpperCase()}]`)).join("");

// Every way of writing a currency: { text, codes, suffix, exact }. A name
// that's also a CLDR symbol ("lei") gets the codes of both.
const ALIASES = (() => {
  const byText = new Map(Object.entries(money.CURRENCY_SYMBOLS)
    .map(([text, codes]) => [text.toLowerCase(), { text, codes, suffix: false, exact: true }]));
  for (const { names, codes, suffix = false, exact = false } of EXTRA_NAMES) {
    for (const text of names) {
      const known = byText.get(text.toLowerCase());
      if (known) {
        known.codes = [...new Set([...known.codes, ...codes])];
        known.exact &&= exact;
      } else {
        byText.set(text.toLowerCase(), { text, codes, suffix, exact });
      }
    }
  }
  return [...byText.values()].sort((a, b) => b.text.length - a.text.length);
})();

const aliasPattern = (aliases) => aliases.map((a) => (a.exact ? escapeRe(a.text) : anyCase(a.text))).join("|");
const PRICE_CODES = money.CURRENCY_CODES.join("|");
const PRICE_NUM = money.NUMBER_PATTERN;
const MULTIPLIERS = { k: 1e3, K: 1e3, thousand: 1e3, M: 1e6, mln: 1e6, million: 1e6, млн: 1e6, bn: 1e9, billion: 1e9, млрд: 1e9 };
const PRICE_MULT = String.raw`(?:\s?(${Object.keys(MULTIPLIERS).join("|")}))?`;
const PRICE_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const PRICE_BEFORE_NUMBER = String.raw`(?<![\p{L}\p{N}.,])`;
const PRICE_AFTER = String.raw`(?![\p{L}\p{N}])`;

// Symbol/name or upper-case ISO code before or after the number.
const PATTERNS = [
  { where: "before", re: new RegExp(String.raw`${PRICE_BEFORE}(${aliasPattern(ALIASES.filter((a) => !a.suffix))}|${PRICE_CODES})\s?(${PRICE_NUM})${PRICE_MULT}${PRICE_AFTER}`, "gu") },
  { where: "after", re: new RegExp(String.raw`${PRICE_BEFORE_NUMBER}(${PRICE_NUM})${PRICE_MULT}\s?(${aliasPattern(ALIASES)}|${PRICE_CODES})${PRICE_AFTER}`, "gu") },
];

// Any-case codes count when the selection is just the price: "ron 50".
const WHOLE = new RegExp(String.raw`^\s*(?:([A-Za-z]{3})\s?(${PRICE_NUM})|(${PRICE_NUM})\s?([A-Za-z]{3}))\s*$`, "u");

function aliasFor(written) {
  return ALIASES.find((a) => (a.exact ? a.text === written : a.text.toLowerCase() === written.toLowerCase()));
}

// Most likely first: the page's own currency ("$" on a .ca site is CAD; ISO
// codes start with the country code), then the most used ones.
function rankCodes(codes, region) {
  const score = (code) => {
    if (region && code.startsWith(region)) return -1;
    const i = POPULAR.indexOf(code);
    return i < 0 ? POPULAR.length : i;
  };
  return [...codes].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

// Finds prices in `text`. Each has `codes` (most likely first) and
// `symbol`: how the currency was written, or null for an ISO code.
// `region`: the page's country ("CA"). `decimalComma`: see parseNumber.
function findPrices(text, { region = "", decimalComma = false } = {}) {
  const read = (s) => money.parseNumber(s, { decimalComma });
  const price = (start, written, number, multiplier, currency) => {
    const amount = read(number) * (MULTIPLIERS[multiplier] ?? 1);
    if (!Number.isFinite(amount)) return null;
    const isCode = money.CURRENCY_CODES.includes(currency);
    const codes = isCode ? [currency] : aliasFor(currency)?.codes;
    if (!codes) return null;
    return {
      start, end: start + written.length, text: written.trim(), amount,
      codes: rankCodes(codes, region), symbol: isCode ? null : currency,
    };
  };

  const whole = text.match(WHOLE);
  if (whole) {
    const code = (whole[1] ?? whole[4]).toUpperCase();
    if (money.CURRENCY_CODES.includes(code)) {
      const found = price(0, text, whole[2] ?? whole[3], undefined, code);
      return found ? [found] : [];
    }
  }

  const candidates = [];
  for (const { where, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const found = where === "before"
        ? price(m.index, m[0], m[2], m[3], m[1])
        : price(m.index, m[0], m[1], m[2], m[3]);
      if (found) candidates.push(found);
    }
  }
  candidates.sort((x, y) => x.start - y.start || y.end - x.end);
  const result = [];
  for (const c of candidates) {
    if (!result.length || c.start >= result[result.length - 1].end) result.push(c);
  }
  return result;
}

// `rates`: units of each currency per 1 EUR. Returns null when a rate is
// missing or nothing needs converting.
function convertPrice(amount, from, to, rates) {
  if (from === to) return null;
  const rate = (code) => (code === "EUR" ? 1 : code === "BGN" ? BGN_PER_EUR : rates?.[code]);
  if (!rate(from) || !rate(to)) return null;
  return (amount / rate(from)) * rate(to);
}

function formatMoney(value, code, locale) {
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
}

if (typeof module !== "undefined") {
  module.exports = { BGN_PER_EUR, findPrices, convertPrice, formatMoney };
}
