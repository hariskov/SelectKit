// Building Google Translate links. Shared by the background and content
// scripts, and loaded by the unit tests in Node.

// Google Translate's web page takes at most 5000 characters, and Google
// rejects long URLs: 13.5 KB worked, 18 KB returned HTTP 400 (measured
// 2026-10). Non-Latin text costs up to 9 URL characters per character, so
// both limits apply.
const TRANSLATE_MAX_CHARS = 5000;
const TRANSLATE_MAX_URL_TEXT = 12000;

const SENTENCE_ENDS = [". ", "! ", "? ", "。", "！", "？", "\n"];

function encodedLength(text) {
  return new URLSearchParams({ t: text }).toString().length - 2;
}

// Cut back to the last sentence end, or failing that the last space,
// as long as that keeps at least half of the text.
function cutAtBoundary(head) {
  const half = head.length / 2;
  const sentenceEnd = Math.max(...SENTENCE_ENDS.map((end) => {
    const i = head.lastIndexOf(end);
    return i < 0 ? -1 : i + end.trimEnd().length;
  }));
  if (sentenceEnd > half) return head.slice(0, sentenceEnd).trimEnd();
  const space = head.search(/\s\S*$/);
  if (space > half) return head.slice(0, space);
  return head;
}

// Returns the text to put in the link, and whether it had to be shortened.
function fitForTranslate(fullText) {
  const text = fullText.trim();
  if (text.length <= TRANSLATE_MAX_CHARS && encodedLength(text) <= TRANSLATE_MAX_URL_TEXT) {
    return { text, truncated: false };
  }
  // Longest prefix within both limits.
  let lo = 0;
  let hi = Math.min(text.length, TRANSLATE_MAX_CHARS);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (encodedLength(text.slice(0, mid)) <= TRANSLATE_MAX_URL_TEXT) lo = mid;
    else hi = mid - 1;
  }
  let head = text.slice(0, lo);
  // Don't split an emoji or other surrogate pair.
  if (/[\uD800-\uDBFF]$/.test(head)) head = head.slice(0, -1);
  return { text: cutAtBoundary(head), truncated: true };
}

function googleTranslateUrl(text, targetLang) {
  const params = new URLSearchParams({ sl: "auto", tl: targetLang, text, op: "translate" });
  return `https://translate.google.com/?${params}`;
}

if (typeof module !== "undefined") {
  module.exports = { fitForTranslate, googleTranslateUrl, TRANSLATE_MAX_CHARS, TRANSLATE_MAX_URL_TEXT };
}
