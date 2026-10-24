const popup = new SelectionPopup();
let settings = { ...DEFAULT_SETTINGS };
// Exchange rates from the background script; loaded when a price is first selected.
let rates = null;
let ratesRequest = null;

getSettings().then((stored) => { settings = stored; });
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
  }
  if (area === "local" && changes.rates) rates = changes.rates.newValue ?? null;
});

function loadRates() {
  ratesRequest ??= browser.runtime.sendMessage({ type: "get-rates" })
    .then((loaded) => { rates = loaded; })
    .catch(() => {})
    .finally(() => { ratesRequest = null; });
  return ratesRequest;
}

// What the popup is showing, so it can be redrawn when rates arrive or the
// assumed currency is switched.
let current = null;

function render() {
  if (current) popup.show(current.x, current.y, buildActions(current.text));
}

function selectedText() {
  return window.getSelection().toString().trim();
}

// Text fields and rich-text editors are left alone. Firefox reports a
// selection inside an <input> as the page selection, so check the focus too.
function inEditable(event) {
  const target = event.composedPath()[0];
  const active = document.activeElement;
  return [target, active].some((el) =>
    el instanceof Element &&
    (el.closest("input, textarea, select") || el.isContentEditable));
}

// Language and country of the selected text: the nearest lang attribute
// (so a British quote on another page still counts as British), else the
// site's country domain.
function selectionContext() {
  const node = window.getSelection().anchorNode;
  const el = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
  const lang = el?.closest("[lang]")?.lang || document.documentElement.lang || "";
  const tld = location.hostname.split(".").pop().toUpperCase();
  const domainRegion = tld === "UK" ? "GB" : /^[A-Z]{2}$/.test(tld) ? tld : "";
  const region = (lang.split(/[-_]/)[1] || "").toUpperCase() || domainRegion;
  return { region, uk: region === "GB", decimalComma: usesDecimalComma(lang) };
}

const MAX_CONVERSIONS = 3;
// Longer selections are prose, not prices or measurements worth converting.
const MAX_CONVERSION_TEXT = 300;

function copyAction(label, title, value) {
  return {
    label,
    title,
    className: "result",
    onClick: async (button) => {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
      setTimeout(() => popup.hide(), 600);
    },
  };
}

// The currency picked for an ambiguous symbol on this page ("$" -> CAD),
// after the user switched it in the popup.
const assumedCurrency = new Map();

function priceActions(text) {
  if (text.length > MAX_CONVERSION_TEXT) return [];
  const prices = findPrices(text, selectionContext()).slice(0, MAX_CONVERSIONS);
  if (!prices.length) return [];
  if (!rates) {
    loadRates().then(() => {
      if (rates && popup.isOpen && current?.text === text) render();
    });
    return [];
  }

  const target = settings.targetCurrency;
  const rateDate = rates.ecbDate ?? rates.otherDate;
  const actions = [];
  for (const price of prices) {
    const code = assumedCurrency.get(price.symbol) ?? price.codes[0];
    const value = convertPrice(price.amount, code, target, rates.values);
    if (value !== null) {
      const out = formatMoney(value, target);
      const source = price.symbol ? `${price.text} (${code})` : price.text;
      const label = price.symbol || prices.length > 1 ? `${source} ≈ ${out}` : `≈ ${out}`;
      actions.push(copyAction(label, `Copy “${out}” · rates of ${rateDate}`, out));
    }
    if (price.codes.length > 1) {
      const next = price.codes[(price.codes.indexOf(code) + 1) % price.codes.length];
      actions.push({
        label: `${code} ⇄`,
        title: `“${price.symbol}” taken as ${code}. Click for ${next}.`,
        className: "switch",
        onClick: () => {
          assumedCurrency.set(price.symbol, next);
          render();
        },
      });
    }
  }
  return actions;
}

function measurementActions(text) {
  if (text.length > MAX_CONVERSION_TEXT) return [];
  const prefs = unitPrefs(settings);
  const results = findMeasurements(text, selectionContext())
    .map((found) => ({ found, out: convertMeasurement(found, prefs) }))
    .filter(({ out }) => out)
    .slice(0, MAX_CONVERSIONS);

  return results.map(({ found, out }) => {
    const source = found.note ? `${found.text} (${found.note})` : found.text;
    const showSource = results.length > 1 || found.note;
    return copyAction(showSource ? `${source} ≈ ${out}` : `≈ ${out}`, `Copy “${out}”`, out);
  });
}

async function translate(text) {
  if (fitForTranslate(text).truncated) {
    // Too long for the link: put the whole text on the clipboard as well.
    await navigator.clipboard.writeText(text).catch(() => {});
  }
  await browser.runtime.sendMessage({ type: "translate", text });
}

function buildActions(text) {
  return [
    ...priceActions(text),
    ...measurementActions(text),
    {
      label: `Translate → ${settings.targetLang.toUpperCase()}`,
      title: "Open in Google Translate",
      onClick: () => {
        popup.hide();
        translate(text);
      },
    },
    {
      label: "Copy",
      onClick: async (button) => {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
        setTimeout(() => popup.hide(), 600);
      },
    },
  ];
}

document.addEventListener("mouseup", (event) => {
  if (event.button !== 0 || popup.contains(event)) return;
  if (inEditable(event)) {
    popup.hide();
    return;
  }
  // Let the browser finish updating the selection (matters for double/triple click).
  setTimeout(() => {
    // Double/triple click already select whole words/paragraphs.
    if (settings.wordWrapper && event.detail === 1) wrapSelectionToWords();
    const text = selectedText();
    if (!text) {
      current = null;
      popup.hide();
      return;
    }
    current = { text, x: event.clientX, y: event.clientY };
    render();
  }, 0);
}, true);

document.addEventListener("mousedown", (event) => {
  if (!popup.contains(event)) popup.hide();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") popup.hide();
}, true);

document.addEventListener("selectionchange", () => {
  if (popup.isOpen && !selectedText()) popup.hide();
});

window.addEventListener("scroll", () => popup.hide(), { passive: true, capture: true });
window.addEventListener("resize", () => popup.hide());
