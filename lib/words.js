// Word boundaries for the Word wrapper. Pure string logic, so it can be
// unit tested in Node; content/wordwrapper.js applies it to the page.

// Intl.Segmenter knows word boundaries for every script, including languages
// written without spaces (Chinese, Japanese, Thai use dictionaries).
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

// Only this much text around a position is segmented; no word is longer.
const WORD_CONTEXT = 64;

// If `offset` falls strictly inside a word of `text`, returns that word's
// { start, end } offsets; otherwise (at a boundary, on a space or
// punctuation) null.
function wordAround(text, offset) {
  if (offset <= 0 || offset >= text.length) return null;
  const from = Math.max(0, offset - WORD_CONTEXT);
  const slice = text.slice(from, offset + WORD_CONTEXT);
  const segment = wordSegmenter.segment(slice).containing(offset - from);
  if (!segment || !segment.isWordLike) return null;
  const start = from + segment.index;
  const end = start + segment.segment.length;
  return start < offset && offset < end ? { start, end } : null;
}

// Grows the range [start, end) of `text` so every word it touches is whole.
function wrapToWords(text, start, end) {
  const first = wordAround(text, start);
  const last = wordAround(text, end);
  return { start: first ? first.start : start, end: last ? last.end : end };
}

if (typeof module !== "undefined") {
  module.exports = { wordAround, wrapToWords };
}
