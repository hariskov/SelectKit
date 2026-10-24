console.log(`SelectKit ${browser.runtime.getManifest().version} loaded`);

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());

// --- Translate in a new tab ---

async function openTranslateTab(text, sourceTab) {
  const { targetLang } = await getSettings();
  const { text: fitted } = fitForTranslate(text);
  if (!fitted) return;
  await browser.tabs.create({
    url: googleTranslateUrl(fitted, targetLang),
    index: sourceTab ? sourceTab.index + 1 : undefined,
    openerTabId: sourceTab ? sourceTab.id : undefined,
  });
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "translate") return openTranslateTab(msg.text, sender.tab);
});

// Asks the page to translate its selection (used by the context menu). The
// content script copies the full text to the clipboard when it's too long
// for the link. Resolves to false when no frame handled it (no selection, or
// a page where content scripts can't run, like about: pages or the PDF viewer).
async function translateInPage(tab, frameId) {
  try {
    return (await browser.tabs.sendMessage(tab.id, { type: "translate-selection" }, { frameId })) === true;
  } catch {
    return false;
  }
}

// --- Context menu ---

async function menuTitle() {
  const { targetLang } = await getSettings();
  return `Translate “%s” → ${targetLang.toUpperCase()}`;
}

// Recreated every time the background script starts, so it's always there.
browser.menus.removeAll().then(async () => {
  browser.menus.create({ id: "translate", title: await menuTitle(), contexts: ["selection"] });
});

browser.storage.onChanged.addListener(async (changes) => {
  if (changes.targetLang) browser.menus.update("translate", { title: await menuTitle() });
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "translate") return;
  if (!(await translateInPage(tab, info.frameId))) openTranslateTab(info.selectionText, tab);
});
