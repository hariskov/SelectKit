// Toolbar panel: about SelectKit, and a way into the settings.

// Update together with the version in manifest.json.
const RELEASE_DATE = "2026-10-27";

document.getElementById("version").textContent =
  `Version ${browser.runtime.getManifest().version} · ${RELEASE_DATE}`;

document.getElementById("settings").addEventListener("click", () => {
  browser.runtime.openOptionsPage();
  window.close();
});

browser.storage.local.get("rates").then(({ rates }) => {
  document.getElementById("rates").textContent = rates
    ? `Exchange rates from ${rates.ecbDate ?? rates.otherDate}.`
    : "Exchange rates are downloaded the first time you select a price.";
});
