const NUMBER_PATTERN = String.raw`[-−]?(?:\d{1,2},(?:\d{2},)+\d{3}|\d{1,3}(?:[,.'’   ]\d{3})+|\d+)(?:[.,]\d+)?|[-−]?[.,]\d+`;

// With decimalComma (the page's language writes 2,5), a lone "1.500" is 1500.
function parseNumber(written, { decimalComma = false } = {}) {
  let s = written.trim().replace(/^−/, "-").replace(/[\s'’]/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const group = decimal === "." ? "," : ".";
    s = s.split(group).join("").replace(decimal, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastComma >= 0 ? "," : ".";
    const parts = s.split(separator);
    const isGrouping = parts.length > 2 ||
      (parts[1].length === 3 && parts[0].replace("-", "") !== "" &&
        (separator === "," ? !decimalComma : decimalComma));
    s = isGrouping ? parts.join("") : parts.join(".");
  }
  return s === "" || s === "-" ? NaN : Number(s);
}

const decimalCommaByLang = new Map();

function usesDecimalComma(lang) {
  if (!decimalCommaByLang.has(lang)) {
    let comma = false;
    try {
      comma = new Intl.NumberFormat(lang).format(1.5).includes(",");
    } catch {
      // No or invalid language tag.
    }
    decimalCommaByLang.set(lang, comma);
  }
  return decimalCommaByLang.get(lang);
}

const numberFormats = new Map();

function numberFormat(locale, options) {
  const key = JSON.stringify([locale ?? null, options]);
  if (!numberFormats.has(key)) numberFormats.set(key, new Intl.NumberFormat(locale, options));
  return numberFormats.get(key);
}
