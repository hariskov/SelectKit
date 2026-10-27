// Fixed since Bulgaria adopted the euro on 2026-01-01.
const BGN_PER_EUR = 1.95583;

// Everyday names CLDR doesn't have. Case-insensitive unless `exact`;
// `suffix` names only count after the number ("5 lv", not "lv 5 armor").
const EXTRA_CURRENCY_NAMES = [
  { names: ["лв", "лв.", "лева", "лев"], codes: ["BGN"] },
  { names: ["lv"], codes: ["BGN"], suffix: true },
  { names: ["lei", "leu"], codes: ["RON", "MDL"] },
  { names: ["euro", "euros", "евро"], codes: ["EUR"], suffix: true },
  { names: ["dollar", "dollars", "долар", "долара"], codes: CURRENCY_SYMBOLS.$, suffix: true },
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
  { names: ["rupee", "rupees"], codes: CURRENCY_SYMBOLS.Rs, suffix: true },
];

// ISO codes that are also English words: never before the number ("TOP 10",
// "ALL 5"), and only in upper case on their own ("TRY 40", not "top 10").
const WORD_LIKE_CODES = new Set(["ALL", "AMD", "BAM", "BOB", "CUP", "GEL", "MAD", "MOP", "PEN", "SOS", "TOP", "TRY"]);

const POPULAR_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "CAD", "AUD", "CHF", "INR", "KRW", "SEK", "NOK", "DKK",
  "MXN", "NZD", "SGD", "HKD", "RON", "PKR", "TWD", "BRL", "ISK", "LKR", "NPR",
];

const CURRENCY_CODE_SET = new Set(CURRENCY_CODES);

// Keyed by lower case; a name that's also a CLDR symbol ("lei") gets the
// codes of both.
const CURRENCY_ALIASES = (() => {
  const aliases = new Map(Object.entries(CURRENCY_SYMBOLS)
    .map(([text, codes]) => [text.toLowerCase(), { text, codes, suffix: false, exact: true }]));
  for (const { names, codes, suffix = false, exact = false } of EXTRA_CURRENCY_NAMES) {
    for (const text of names) {
      const known = aliases.get(text.toLowerCase());
      if (known) {
        known.codes = [...new Set([...known.codes, ...codes])];
        known.exact &&= exact;
      } else {
        aliases.set(text.toLowerCase(), { text, codes, suffix, exact });
      }
    }
  }
  return aliases;
})();

function aliasFor(written) {
  const alias = CURRENCY_ALIASES.get(written.toLowerCase());
  return alias && (!alias.exact || alias.text === written) ? alias : null;
}

const aliasPattern = (aliases) => aliases
  .sort((a, b) => b.text.length - a.text.length)
  .map((a) => (a.exact ? escapeRegExp(a.text) : anyCase(a.text)))
  .join("|");

const MULTIPLIERS = { k: 1e3, K: 1e3, thousand: 1e3, M: 1e6, mln: 1e6, million: 1e6, млн: 1e6, bn: 1e9, billion: 1e9, млрд: 1e9 };
const MULTIPLIER_PATTERN = String.raw`(?:\s?(${Object.keys(MULTIPLIERS).join("|")}))?`;
const allAliases = [...CURRENCY_ALIASES.values()];
const codesBefore = CURRENCY_CODES.filter((code) => !WORD_LIKE_CODES.has(code)).join("|");

const PRICE_BEFORE_NUMBER = new RegExp(
  String.raw`${NO_WORD_BEFORE}(${aliasPattern(allAliases.filter((a) => !a.suffix))}|${codesBefore})\s?(${NUMBER_PATTERN})${MULTIPLIER_PATTERN}${NO_WORD_AFTER}`, "gu");
const PRICE_AFTER_NUMBER = new RegExp(
  String.raw`${NO_NUMBER_BEFORE}(${NUMBER_PATTERN})${MULTIPLIER_PATTERN}\s?(${aliasPattern(allAliases)}|${CURRENCY_CODES.join("|")})${NO_WORD_AFTER}`, "gu");
// Any-case codes count when the selection is only the price: "ron 50".
const WHOLE_PRICE = new RegExp(String.raw`^\s*(?:([A-Za-z]{3})\s?(${NUMBER_PATTERN})|(${NUMBER_PATTERN})\s?([A-Za-z]{3}))\s*$`, "u");

// ISO codes start with the country code, so "$" on a Canadian page is CAD.
function rankCurrencies(codes, region) {
  const score = (code) => {
    if (region && code.startsWith(region)) return -1;
    const i = POPULAR_CURRENCIES.indexOf(code);
    return i < 0 ? POPULAR_CURRENCIES.length : i;
  };
  return [...codes].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

function findPrices(text, { region = "", decimalComma = false } = {}) {
  const price = (start, written, number, multiplier, currency) => {
    const amount = parseNumber(number, { decimalComma }) * (MULTIPLIERS[multiplier] ?? 1);
    const isCode = CURRENCY_CODE_SET.has(currency);
    const codes = isCode ? [currency] : aliasFor(currency)?.codes;
    if (!Number.isFinite(amount) || !codes) return null;
    return {
      start, end: start + written.length, text: written.trim(), amount,
      codes: rankCurrencies(codes, region), symbol: isCode ? null : currency,
    };
  };

  const whole = text.match(WHOLE_PRICE);
  const written = whole && (whole[1] ?? whole[4]);
  const wholeCode = written?.toUpperCase();
  if (CURRENCY_CODE_SET.has(wholeCode) && (written === wholeCode || !WORD_LIKE_CODES.has(wholeCode))) {
    const found = price(0, text, whole[2] ?? whole[3], undefined, wholeCode);
    return found ? [found] : [];
  }

  const found = [
    ...[...text.matchAll(PRICE_BEFORE_NUMBER)].map((m) => price(m.index, m[0], m[2], m[3], m[1])),
    ...[...text.matchAll(PRICE_AFTER_NUMBER)].map((m) => price(m.index, m[0], m[1], m[2], m[3])),
  ];
  return keepLongest(found.filter(Boolean));
}

function convertPrice(amount, from, to, rates) {
  if (from === to) return null;
  const rate = (code) => (code === "EUR" ? 1 : code === "BGN" ? BGN_PER_EUR : rates?.[code]);
  if (!rate(from) || !rate(to)) return null;
  return (amount / rate(from)) * rate(to);
}

function formatMoney(value, code, locale) {
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return numberFormat(locale, {
    style: "currency", currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
}
