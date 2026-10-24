const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_SETTINGS, siteOf, blockingEntry } = require("../lib/settings.js");

test("siteOf turns URLs and host names into sites", () => {
  assert.equal(siteOf("https://www.Example.com/page?x=1"), "example.com");
  assert.equal(siteOf("example.com"), "example.com");
  assert.equal(siteOf("  sub.Site.org "), "sub.site.org");
  assert.equal(siteOf("news.bbc.co.uk"), "news.bbc.co.uk");
  assert.equal(siteOf("about:blank"), null);
  assert.equal(siteOf("localhost"), "localhost");
  assert.equal(siteOf("http://localhost:8000/playground.html"), "localhost");
  assert.equal(siteOf(""), null);
});

test("blockingEntry covers the site and its subdomains only", () => {
  const list = ["example.com", "bbc.co.uk"];
  assert.equal(blockingEntry("example.com", list), "example.com");
  assert.equal(blockingEntry("www.example.com", list), "example.com");
  assert.equal(blockingEntry("a.b.example.com", list), "example.com");
  assert.equal(blockingEntry("news.bbc.co.uk", list), "bbc.co.uk");
  assert.equal(blockingEntry("notexample.com", list), undefined);
  assert.equal(blockingEntry("google.com", list), undefined);
  assert.equal(blockingEntry("localhost", list), undefined);
  assert.equal(blockingEntry("localhost", ["localhost"]), "localhost");
});

test("defaults: popup immediately, no blocked sites", () => {
  assert.equal(DEFAULT_SETTINGS.popupDelay, 0);
  assert.deepEqual(DEFAULT_SETTINGS.blockedSites, []);
});
