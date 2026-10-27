const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..", "..");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

const isPromise = (value) => typeof value?.then === "function";

// Values from another realm fail assert.deepStrictEqual's prototype check.
function toThisRealm(value) {
  if (isPromise(value)) return Promise.resolve(value).then(toThisRealm);
  if (value === null || typeof value !== "object") return value;
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

// Runs extension scripts in one shared scope, as Firefox does, and returns
// their top-level names (const and function alike).
function loadScripts(files, globals = {}) {
  const context = vm.createContext({ console, setTimeout, clearTimeout, URL, URLSearchParams, ...globals });
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  return new Proxy({}, {
    get(_, name) {
      if (typeof name !== "string") return undefined;
      const value = vm.runInContext(name, context);
      return typeof value === "function" ? (...args) => toThisRealm(value(...args)) : toThisRealm(value);
    },
  });
}

module.exports = { ROOT, MANIFEST, loadScripts };
