const popup = new SelectionPopup();
let settings = { ...DEFAULT_SETTINGS };

getSettings().then((stored) => { settings = stored; });
browser.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
});

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

async function translate(text) {
  if (fitForTranslate(text).truncated) {
    // Too long for the link: put the whole text on the clipboard as well.
    await navigator.clipboard.writeText(text).catch(() => {});
  }
  await browser.runtime.sendMessage({ type: "translate", text });
}

function buildActions(text) {
  return [
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
      popup.hide();
      return;
    }
    popup.show(event.clientX, event.clientY, buildActions(text));
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
