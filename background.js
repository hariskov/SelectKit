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
