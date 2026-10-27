const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

const WORD_CONTEXT = 64;

// The word that `offset` is strictly inside of, or null at a boundary,
// space or punctuation.
function wordAround(text, offset) {
  if (offset <= 0 || offset >= text.length) return null;
  const from = Math.max(0, offset - WORD_CONTEXT);
  const segment = wordSegmenter.segment(text.slice(from, offset + WORD_CONTEXT)).containing(offset - from);
  if (!segment?.isWordLike) return null;
  const start = from + segment.index;
  const end = start + segment.segment.length;
  return start < offset && offset < end ? { start, end } : null;
}

function wrapToWords(text, start, end) {
  return {
    start: wordAround(text, start)?.start ?? start,
    end: wordAround(text, end)?.end ?? end,
  };
}
