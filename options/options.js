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

// --- Exchange rates ---

function describeRates(rates) {
  if (!rates) return "Exchange rates haven't been downloaded yet. They're fetched the first time you select a price.";
  const days = Math.floor((Date.now() - rates.fetchedAt) / 86400000);
  const checked = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  const sources = [rates.ecbDate && `ECB ${rates.ecbDate}`, rates.otherDate && `exchange-api ${rates.otherDate}`]
    .filter(Boolean).join(", ");
  return `Rates: ${sources}. Downloaded ${checked}; updated weekly.`;
}

async function renderRates() {
  const info = document.getElementById("ratesInfo");
  const button = document.getElementById("refreshRates");
  const { rates } = await browser.storage.local.get("rates");
  info.textContent = describeRates(rates);
  button.addEventListener("click", async () => {
    button.disabled = true;
    info.textContent = "Downloading…";
    const before = (await browser.storage.local.get("rates")).rates;
    const fresh = await browser.runtime.sendMessage({ type: "refresh-rates" });
    const failed = !fresh || fresh.fetchedAt === before?.fetchedAt;
    info.textContent = failed
      ? `Couldn't download new rates. ${describeRates(fresh)}`
      : describeRates(fresh);
    button.disabled = false;
  });
}

// --- Units ---

function renderUnits(settings) {
  const presetBox = document.getElementById("unitPresets");
  const prefBox = document.getElementById("unitPrefs");
  const selects = {};

  // A preset button is shown pressed while every unit matches it.
  const presetButtons = {};
  function markPreset() {
    for (const [name, values] of Object.entries(UNIT_PRESETS)) {
      const matches = Object.entries(values).every(([key, value]) => selects[key].value === value);
      presetButtons[name].setAttribute("aria-pressed", String(matches));
    }
  }

  for (const { key, label, choices } of UNIT_PREFERENCES) {
    const row = document.createElement("label");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = label;
    const select = document.createElement("select");
    for (const [value, text] of Object.entries(choices)) select.add(new Option(text, value));
    select.value = settings[key];
    select.addEventListener("change", async () => {
      await save(key, select.value);
      markPreset();
    });
    selects[key] = select;
    row.append(name, select);
    prefBox.append(row);
  }

  for (const [name, values] of Object.entries(UNIT_PRESETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.addEventListener("click", async () => {
      for (const [key, value] of Object.entries(values)) selects[key].value = value;
      await saveSettings(values);
      showSaved();
      markPreset();
    });
    presetButtons[name] = button;
    presetBox.append(button);
  }
  markPreset();
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
  renderUnits(settings);
  renderRates();
  renderWordWrapper(settings.wordWrapper);
});
