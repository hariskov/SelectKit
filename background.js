async function openTranslateTab(text, sourceTab) {
  const { targetLang } = await getSettings();
  const { text: fitted } = fitForTranslate(text);
  if (!fitted) return;
  await browser.tabs.create({
    url: googleTranslateUrl(fitted, targetLang),
    index: sourceTab ? sourceTab.index + 1 : undefined,
    openerTabId: sourceTab?.id,
  });
}

browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case "translate": return openTranslateTab(message.text, sender.tab);
    case "get-rates": return getRates();
    case "refresh-rates": return getRates({ refresh: true });
    default: return undefined;
  }
});
