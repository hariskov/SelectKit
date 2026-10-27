const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./helpers/load.js");
const { wordAround, wrapToWords } = loadScripts(["lib/words.js"]);

// Wraps the first occurrence of `part` in `text` and returns the result.
function wrap(text, part) {
  const start = text.indexOf(part);
  assert.ok(start >= 0, `"${part}" not in "${text}"`);
  const { start: s, end: e } = wrapToWords(text, start, start + part.length);
  return text.slice(s, e);
}

test("partial words at both edges are completed", () => {
  assert.equal(wrap("select all words", "ect all wor"), "select all words");
});

test("partial word at one edge only", () => {
  assert.equal(wrap("select all words", "select all wo"), "select all words");
  assert.equal(wrap("select all words", "lect all"), "select all");
});

test("selection inside a single word becomes that word", () => {
  assert.equal(wrap("select all words", "ll"), "all");
});

test("edges on word boundaries don't move", () => {
  assert.equal(wrap("select all words", "select all"), "select all");
  assert.equal(wrap("select all words", " all "), " all ");
});

test("edges on punctuation don't move", () => {
  assert.equal(wrap("hello, world!", ", wor"), ", world");
  assert.equal(wrap("hello, world!", "lo, world!"), "hello, world!");
});

test("Bulgarian", () => {
  assert.equal(wrap("селектирай всички думи", "ктирай всич"), "селектирай всички");
});

test("accented Latin", () => {
  assert.equal(wrap("Die Straße ist naïve café", "aße ist na"), "Straße ist naïve");
  assert.equal(wrap("Die Straße ist naïve café", "af"), "café");
});

test("Arabic (RTL text is stored in reading order)", () => {
  assert.equal(wrap("مرحبا بالعالم الجميل", "حبا بالعا"), "مرحبا بالعالم");
});

test("Japanese snaps to dictionary words", () => {
  assert.equal(wrap("今日はとても良い天気ですね。", "日はとて"), "今日はとても");
  assert.equal(wrap("今日はとても良い天気ですね。", "気"), "天気");
});

test("Chinese and Thai snap to dictionary words", () => {
  assert.equal(wrap("我们明天在火车站见面吧。", "天在火"), "明天在火车");
  assert.equal(wrap("สวัสดีครับ วันนี้อากาศดี", "ากา"), "อากาศ");
});

test("numbers are completed whole", () => {
  assert.equal(wrap("costs 12.50 today", "2.5"), "12.50");
});

test("hyphenated words: only the touched part is completed", () => {
  assert.equal(wrap("a well-known fact", "ell"), "well");
});

test("wordAround at text edges and in spaces", () => {
  assert.equal(wordAround("word", 0), null);
  assert.equal(wordAround("word", 4), null);
  assert.equal(wordAround("two words", 3), null);
  assert.deepEqual(wordAround("two words", 5), { start: 4, end: 9 });
});

test("long text: only nearby text is segmented, result is still right", () => {
  const text = "filler ".repeat(500) + "selection target" + " filler".repeat(500);
  assert.equal(wrap(text, "ction tar"), "selection target");
});
