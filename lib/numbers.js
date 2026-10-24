// Reading numbers as people write them: 1,234.5 · 1.234,5 · 1 234,5 ·
// 1'234.5 · 1,23,456 (Indian) · 2,5 · −40. Used for units and prices.

// Matches one written number. Grouped forms come first so "1,234.5" isn't
// read as "1".
const NUMBER_PATTERN = String.raw`[-−]?(?:\d{1,2},(?:\d{2},)+\d{3}|\d{1,3}(?:[,.'’   ]\d{3})+|\d+)(?:[.,]\d+)?|[-−]?[.,]\d+`;

// `decimalComma`: the page's language writes 2,5 for two and a half, so a
// lone "1.500" means fifteen hundred.
function parseNumber(written, { decimalComma = false } = {}) {
  let s = written.trim().replace(/^−/, "-").replace(/[\s'’  ]/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    // Both used: whichever comes last is the decimal point.
    const decimal = lastDot > lastComma ? "." : ",";
    const group = decimal === "." ? "," : ".";
    s = s.split(group).join("").replace(decimal, ".");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const parts = s.split(sep);
    const isGrouping =
      parts.length > 2 ||
      (parts[1].length === 3 && parts[0].replace("-", "").length > 0 &&
        (sep === "," ? !decimalComma : decimalComma));
    s = isGrouping ? parts.join("") : parts.join(".");
  }
  return s === "" || s === "-" ? NaN : Number(s);
}

// Does this page language write decimals with a comma (de, bg, ro, fr, ...)?
function usesDecimalComma(lang) {
  try {
    return new Intl.NumberFormat(lang).format(1.5).includes(",");
  } catch {
    return false;
  }
}

if (typeof module !== "undefined") {
  module.exports = { NUMBER_PATTERN, parseNumber, usesDecimalComma };
}
