const MAX_CONVERSIONS = 3;
// Longer selections are prose, not prices or measurements.
const MAX_CONVERSION_TEXT = 300;
const CLOSE_AFTER_COPY = 600;

const popup = new SelectionPopup();
let settings = { ...DEFAULT_SETTINGS };
let rates = null;
let ratesRequest = null;
let current = null;
let pendingShow = null;
// Per page: the currency the user switched an ambiguous symbol to.
const assumedCurrency = new Map();

const changedSinceLoad = new Set();

getSettings().then((stored) => {
  for (const [key, value] of Object.entries(stored)) {
    if (!changedSinceLoad.has(key)) settings[key] = value;
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue ?? DEFAULT_SETTINGS[key];
      changedSinceLoad.add(key);
    }
  } else if (area === "local" && changes.rates) {
    rates = changes.rates.newValue ?? null;
  }
});

function loadRates() {
  ratesRequest ??= browser.runtime.sendMessage({ type: "get-rates" })
    .then((loaded) => {
      rates = loaded;
    })
    .catch(() => {})
    .finally(() => {
      ratesRequest = null;
    });
  return ratesRequest;
}

function selectedText() {
  return window.getSelection()?.toString().trim() ?? "";
}

// Firefox reports a selection inside an <input> as the page selection, so
// the focused element is checked as well.
function inEditable(event) {
  return [event.composedPath()[0], document.activeElement].some((element) =>
    element instanceof Element && (element.closest("input, textarea, select") || element.isContentEditable));
}

// From the nearest lang attribute (a British quote counts as British), else
// the site's country domain.
function selectionContext() {
  const node = window.getSelection()?.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const lang = element?.closest("[lang]")?.lang || document.documentElement.lang || "";
  const tld = location.hostname.split(".").pop().toUpperCase();
  const domainRegion = tld === "UK" ? "GB" : /^[A-Z]{2}$/.test(tld) ? tld : "";
  const region = (lang.split(/[-_]/)[1] || "").toUpperCase() || domainRegion;
  return { region, uk: region === "GB", decimalComma: usesDecimalComma(lang) };
}

function siteIsOff() {
  return blockingEntry(location.hostname || "localhost", settings.blockedSites) !== null;
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Couldn't copy";
  }
  setTimeout(() => popup.hide(), CLOSE_AFTER_COPY);
}

function copyAction(label, value, { title, className } = {}) {
  return { label, title, className, onClick: (button) => copy(value, button) };
}

function resultLabel(source, out, showSource) {
  return showSource ? `${source} ≈ ${out}` : `≈ ${out}`;
}

function priceActions(text, context) {
  const prices = findPrices(text, context).slice(0, MAX_CONVERSIONS);
  if (!prices.length) return [];
  if (!rates) {
    loadRates().then(() => {
      if (rates && popup.isOpen && current?.text === text) render();
    });
    return [];
  }

  const target = settings.targetCurrency;
  const title = `rates of ${rates.ecbDate ?? rates.otherDate}`;
  return prices.flatMap((price) => {
    const key = price.symbol?.toLowerCase();
    const code = assumedCurrency.get(key) ?? price.codes[0];
    const actions = [];
    const value = convertPrice(price.amount, code, target, rates.values);
    if (value !== null) {
      const out = formatMoney(value, target);
      const source = price.symbol ? `${price.text} (${code})` : price.text;
      const label = resultLabel(source, out, price.symbol || prices.length > 1);
      actions.push(copyAction(label, out, { title: `Copy “${out}” · ${title}`, className: "result" }));
    }
    if (price.codes.length > 1) {
      const next = price.codes[(price.codes.indexOf(code) + 1) % price.codes.length];
      actions.push({
        label: `${code} ⇄`,
        title: `“${price.symbol}” taken as ${code}. Click for ${next}.`,
        className: "switch",
        onClick: () => {
          assumedCurrency.set(key, next);
          render();
        },
      });
    }
    return actions;
  });
}

function measurementActions(text, context) {
  const prefs = unitPrefs(settings);
  const results = findMeasurements(text, context)
    .map((found) => ({ found, out: convertMeasurement(found, prefs) }))
    .filter(({ out }) => out)
    .slice(0, MAX_CONVERSIONS);
  return results.map(({ found, out }) => {
    const source = found.note ? `${found.text} (${found.note})` : found.text;
    const label = resultLabel(source, out, results.length > 1 || found.note);
    return copyAction(label, out, { title: `Copy “${out}”`, className: "result" });
  });
}

async function translate(text) {
  if (fitForTranslate(text).truncated) {
    await navigator.clipboard.writeText(text).catch(() => {});
  }
  await browser.runtime.sendMessage({ type: "translate", text });
}

function buildActions({ text, context }) {
  const conversions = text.length > MAX_CONVERSION_TEXT
    ? []
    : [...priceActions(text, context), ...measurementActions(text, context)];
  return [
    ...conversions,
    {
      label: `Translate → ${settings.targetLang.toUpperCase()}`,
      title: "Open in Google Translate",
      onClick: () => {
        popup.hide();
        translate(text);
      },
    },
    copyAction("Copy", text),
  ];
}

function render() {
  if (current) popup.show(current.x, current.y, buildActions(current));
}

function showPopup(text, x, y) {
  current = { text, x, y, context: selectionContext() };
  render();
}

document.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || popup.contains(event) || siteIsOff()) return;
  if (inEditable(event)) {
    popup.hide();
    return;
  }
  // After the browser has finished updating the selection.
  setTimeout(() => {
    // A triple click selects the whole paragraph already.
    if (settings.wordWrapper && event.detail < 3) wrapSelection();
    const text = selectedText();
    clearTimeout(pendingShow);
    if (!text) {
      current = null;
      popup.hide();
    } else if (settings.popupDelay > 0) {
      pendingShow = setTimeout(() => {
        if (selectedText() === text) showPopup(text, event.clientX, event.clientY);
      }, settings.popupDelay);
    } else {
      showPopup(text, event.clientX, event.clientY);
    }
  }, 0);
}, true);

document.addEventListener("mousedown", (event) => {
  if (popup.contains(event)) return;
  clearTimeout(pendingShow);
  popup.hide();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") popup.hide();
}, true);

document.addEventListener("selectionchange", () => {
  if (popup.isOpen && !selectedText()) popup.hide();
});

window.addEventListener("scroll", () => popup.hide(), { passive: true, capture: true });
window.addEventListener("resize", () => popup.hide());
