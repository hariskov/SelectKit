const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });

const currencyLabel = (code) => `${code} — ${currencyNames.of(code)}`;

const statusEl = document.getElementById("status");
let statusTimer;

function showSaved() {
  statusEl.textContent = "Saved";
  statusEl.style.opacity = "1";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.style.opacity = "0"; }, 1200);
}

async function save(key, value) {
  await saveSetting(key, value);
  showSaved();
}

// --- Translation target ---

function renderTargetLang(current) {
  const box = document.getElementById("targetLang");
  for (const [code, name] of Object.entries(TARGET_LANGUAGES)) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "targetLang";
    input.value = code;
    input.checked = code === current;
    input.addEventListener("change", () => save("targetLang", code));
    label.append(input, name);
    box.append(label);
  }
}

// --- Target currency ---

function renderTargetCurrency(current) {
  const select = document.getElementById("targetCurrency");
  for (const code of TARGET_CURRENCIES) select.add(new Option(currencyLabel(code), code));
  select.value = current;
  select.addEventListener("change", () => save("targetCurrency", select.value));
}

// --- Selection ---

function renderWordWrapper(current) {
  const box = document.getElementById("wordWrapper");
  box.checked = current;
  box.addEventListener("change", () => save("wordWrapper", box.checked));
}

getSettings().then((settings) => {
  renderTargetLang(settings.targetLang);
  renderTargetCurrency(settings.targetCurrency);
  renderWordWrapper(settings.wordWrapper);
});
