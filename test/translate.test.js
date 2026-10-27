const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./helpers/load.js");
const {
  fitForTranslate, googleTranslateUrl, TRANSLATE_MAX_CHARS, TRANSLATE_MAX_URL_TEXT,
} = loadScripts(["lib/translate.js"]);

const urlTextLength = (text) => new URLSearchParams({ t: text }).toString().length - 2;

test("short text is kept as is, trimmed", () => {
  assert.deepEqual(fitForTranslate("  こんにちは  "), { text: "こんにちは", truncated: false });
});

test("long Latin text is cut at a sentence end within 5000 chars", () => {
  const text = "This is a sentence. ".repeat(400); // 8000 chars
  const { text: fitted, truncated } = fitForTranslate(text);
  assert.ok(truncated);
  assert.ok(fitted.length <= TRANSLATE_MAX_CHARS);
  assert.ok(fitted.length > TRANSLATE_MAX_CHARS - 30);
  assert.ok(fitted.endsWith("sentence."));
});

test("long Latin text without sentences is cut at a space", () => {
  const text = "word ".repeat(2000);
  const { text: fitted } = fitForTranslate(text);
  assert.ok(fitted.length <= TRANSLATE_MAX_CHARS);
  assert.ok(fitted.endsWith("word"));
});

test("Japanese text is limited by URL size, cut after 。", () => {
  const text = "これは日本語の文です。".repeat(300); // 3300 chars, ~30 KB encoded
  const { text: fitted, truncated } = fitForTranslate(text);
  assert.ok(truncated);
  assert.ok(urlTextLength(fitted) <= TRANSLATE_MAX_URL_TEXT);
  assert.ok(fitted.length > 1000);
  assert.ok(fitted.endsWith("。"));
});

test("text without any boundary is cut hard but stays within limits", () => {
  const text = "あ".repeat(5000);
  const { text: fitted } = fitForTranslate(text);
  assert.ok(urlTextLength(fitted) <= TRANSLATE_MAX_URL_TEXT);
  assert.ok(urlTextLength(fitted + "あ") > TRANSLATE_MAX_URL_TEXT);
});

test("emoji are never split", () => {
  const text = "😀".repeat(3000);
  const { text: fitted } = fitForTranslate(text);
  assert.doesNotMatch(fitted, /[\uD800-\uDBFF]$/);
  assert.equal([...fitted].join(""), fitted);
});

test("URL carries target language and special characters intact", () => {
  const text = "Tom & Jerry #1? 100% \"quotes\" + plus\nnew line 😀";
  const url = new URL(googleTranslateUrl(text, "bg"));
  assert.equal(url.origin + url.pathname, "https://translate.google.com/");
  assert.equal(url.searchParams.get("sl"), "auto");
  assert.equal(url.searchParams.get("tl"), "bg");
  assert.equal(url.searchParams.get("text"), text);
});
