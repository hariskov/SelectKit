const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts } = require("./helpers/load.js");

const { escapeRegExp, anyCase, keepLongest, NO_WORD_BEFORE, NO_NUMBER_BEFORE, NO_WORD_AFTER } =
  loadScripts(["lib/patterns.js"]);

test("escapeRegExp makes text match literally", () => {
  const special = "1.5 $ (x) [y] {z} a|b c* d+ e? ^f \\g";
  assert.ok(new RegExp(`^${escapeRegExp(special)}$`).test(special));
});

test("anyCase matches any case in any script, and escapes", () => {
  const re = new RegExp(`^${anyCase("лв.")}$`, "u");
  for (const text of ["лв.", "ЛВ.", "Лв."]) assert.ok(re.test(text), text);
  assert.ok(!re.test("лвx"));
  assert.ok(new RegExp(`^${anyCase("Kč")}$`, "u").test("KČ"));
});

test("word boundaries work for any script", () => {
  const re = new RegExp(`${NO_WORD_BEFORE}лв${NO_WORD_AFTER}`, "u");
  assert.ok(re.test("12 лв"));
  assert.ok(!re.test("12 алв"));
  assert.ok(!re.test("12 лвб"));
  const number = new RegExp(`${NO_NUMBER_BEFORE}\\d+`, "u");
  assert.equal("x 1.5".match(number)[0], "1");
  assert.equal("a5 7".match(number)[0], "7");
});

test("keepLongest keeps the longest match at each place and drops overlaps", () => {
  const matches = [
    { start: 10, end: 12, id: "late" },
    { start: 0, end: 4, id: "short" },
    { start: 0, end: 9, id: "long" },
    { start: 5, end: 11, id: "overlap" },
    { start: 9, end: 10, id: "touching" },
  ];
  assert.deepEqual(keepLongest(matches).map((m) => m.id), ["long", "touching", "late"]);
  assert.equal(matches[0].id, "late", "input is not reordered");
  assert.deepEqual(keepLongest([]), []);
});
