const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const anyCase = (text) => [...text]
  .map((c) => (c.toLowerCase() === c.toUpperCase() ? escapeRegExp(c) : `[${c.toLowerCase()}${c.toUpperCase()}]`))
  .join("");

const NO_WORD_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const NO_NUMBER_BEFORE = String.raw`(?<![\p{L}\p{N}.,])`;
const NO_WORD_AFTER = String.raw`(?![\p{L}\p{N}])`;

function keepLongest(matches) {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const match of sorted) {
    if (!kept.length || match.start >= kept[kept.length - 1].end) kept.push(match);
  }
  return kept;
}
