const test = require("node:test");
const assert = require("node:assert/strict");
const { openPage } = require("./helpers/dom.js");

const RATES = { values: { USD: 1.1, CAD: 1.5, RON: 5 }, ecbDate: "2026-10-23", otherDate: null, fetchedAt: Date.now() };

test("Word wrapper completes words at both edges", async () => {
  const page = openPage("<p>select all words</p>");
  page.select("select", 3, "select", 14);
  assert.equal(page.selection(), "ect all wor");
  await page.mouseUp();
  assert.equal(page.selection(), "select all words");
});

test("Word wrapper keeps a backward drag backward", async () => {
  const page = openPage("<p>select all words</p>");
  page.select("select", 14, "select", 3);
  await page.mouseUp();
  const selection = page.window.getSelection();
  assert.equal(page.selection(), "select all words");
  assert.equal(selection.anchorOffset, 16);
  assert.equal(selection.focusOffset, 0);
});

test("Word wrapper works across inline markup", async () => {
  const page = openPage("<p>an im<b>port</b>ant w<i>ord</i> here</p>");
  page.select("port", 1, "ord", 1);
  await page.mouseUp();
  assert.equal(page.selection(), "important word");
});

test("Word wrapper leaves edges on boundaries, and double clicks, alone", async () => {
  const page = openPage("<p>select all words</p>");
  page.select("select", 6, "select", 11);
  await page.mouseUp();
  assert.equal(page.selection(), " all ");

  page.select("select", 8, "select", 9);
  await page.mouseUp(page.document.body, { detail: 2 });
  assert.equal(page.selection(), "l");
});

test("Word wrapper follows its setting", async () => {
  const page = openPage("<p>select all words</p>", { settings: { wordWrapper: false } });
  await page.wait();
  page.select("select", 3, "select", 14);
  await page.mouseUp();
  assert.equal(page.selection(), "ect all wor");
});

test("Word wrapper only reads text near the selection", () => {
  const words = Array.from({ length: 2000 }, (_, i) => `<span>word${i} </span>`).join("");
  const page = openPage(`<p>${words}</p>`);
  const node = page.document.querySelectorAll("span")[1000].firstChild;
  const nearby = page.global("nearbyTextNodes")(node);
  assert.ok(nearby.length < 40, `${nearby.length} nodes`);
  assert.ok(nearby.includes(node));
});

test("popup offers Translate and Copy, and Copy copies", async () => {
  const page = openPage("<p>Bonjour tout le monde</p>");
  page.select("Bonjour", 0, "Bonjour", 7);
  await page.mouseUp();
  assert.ok(page.popupOpen());
  assert.deepEqual(page.labels(), ["Translate → EN", "Copy"]);
  page.button("Copy").click();
  await page.wait();
  assert.deepEqual(page.clipboard, ["Bonjour"]);
  assert.equal(page.button("Copied").textContent, "Copied");
});

test("Translate sends the text to the background script", async () => {
  const page = openPage("<p>Guten Morgen</p>", { settings: { targetLang: "bg" } });
  await page.wait();
  page.select("Guten", 0, "Guten", 12);
  await page.mouseUp();
  page.button("Translate → BG").click();
  await page.wait();
  assert.deepEqual(page.messages.at(-1), { type: "translate", text: "Guten Morgen" });
  assert.ok(!page.popupOpen());
});

test("measurements show a converted value", async () => {
  const page = openPage("<p>He is 5 ft 11 in tall</p>");
  page.select("He is", 6, "He is", 16);
  await page.mouseUp();
  assert.equal(page.labels()[0], "≈ 180 cm");
});

test("prices are converted once rates arrive, and ambiguous symbols can be switched", async () => {
  const page = openPage("<p>It costs $20 today</p>", { rates: RATES });
  page.select("costs", 9, "costs", 12);
  await page.mouseUp();
  await page.wait(10);
  assert.ok(page.messages.some((m) => m.type === "get-rates"));
  assert.match(page.labels()[0], /^\$20 \(USD\) ≈ €18\.18$/);
  assert.equal(page.labels()[1], "USD ⇄");

  page.button("USD ⇄").click();
  assert.match(page.labels()[0], /^\$20 \(CAD\) ≈ €13\.33$/);
  assert.equal(page.labels()[1], "CAD ⇄");
});

test("the page's country decides ambiguous symbols", async () => {
  const page = openPage(`<p lang="en-CA">A coffee is $4.50</p>`, { rates: RATES });
  page.select("coffee", 12, "coffee", 17);
  await page.mouseUp();
  await page.wait(10);
  assert.match(page.labels()[0], /\(CAD\)/);
});

test("no popup for selections in text fields", async () => {
  const page = openPage(`<input value="type here"><p>text</p>`);
  const input = page.document.querySelector("input");
  input.focus();
  input.setSelectionRange(0, 4);
  await page.mouseUp(input);
  assert.ok(!page.popupOpen());
});

test("Esc, a click elsewhere and clearing the selection close the popup", async () => {
  const page = openPage("<p>some text here</p>");
  const open = async () => {
    page.select("some", 0, "some", 9);
    await page.mouseUp();
    assert.ok(page.popupOpen());
  };
  await open();
  page.document.dispatchEvent(new page.window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!page.popupOpen());

  await open();
  page.mouseDown();
  assert.ok(!page.popupOpen());

  await open();
  page.window.getSelection().removeAllRanges();
  page.document.dispatchEvent(new page.window.Event("selectionchange"));
  assert.ok(!page.popupOpen());
});

test("switched-off sites get no popup and no Word wrapper", async () => {
  const page = openPage("<p>select all words</p>", { url: "https://www.example.com/page" });
  page.changeSettings({ blockedSites: ["example.com"] });
  page.select("select", 3, "select", 14);
  await page.mouseUp();
  assert.ok(!page.popupOpen());
  assert.equal(page.selection(), "ect all wor");

  page.changeSettings({ blockedSites: [] });
  await page.mouseUp();
  assert.ok(page.popupOpen());
});

test("a setting changed while the page loads isn't overwritten by the load", async () => {
  const page = openPage("<p>text</p>", { settings: { popupDelay: 0 } });
  page.changeSettings({ popupDelay: 40 });
  await page.wait();
  assert.equal(page.global("settings.popupDelay"), 40);
});

test("a removed setting falls back to its default", async () => {
  const page = openPage("<p>some text</p>");
  page.changeSettings({ blockedSites: undefined, targetLang: undefined });
  page.select("some", 0, "some", 4);
  await page.mouseUp();
  assert.deepEqual(page.labels(), ["Translate → EN", "Copy"]);
});

test("popup delay waits, and a click before then cancels it", async () => {
  const page = openPage("<p>some text here</p>");
  page.changeSettings({ popupDelay: 40 });
  page.select("some", 0, "some", 4);
  await page.mouseUp();
  assert.ok(!page.popupOpen());
  await page.wait(60);
  assert.ok(page.popupOpen());

  page.mouseDown();
  page.select("some", 5, "some", 9);
  await page.mouseUp();
  page.mouseDown();
  await page.wait(60);
  assert.ok(!page.popupOpen());
});
