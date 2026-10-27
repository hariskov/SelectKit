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

async function save(values) {
  await saveSettings(values);
  showSaved();
}


function renderTargetLang(current) {
  const box = document.getElementById("targetLang");
  for (const [code, name] of Object.entries(TARGET_LANGUAGES)) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "targetLang";
    input.value = code;
    input.checked = code === current;
    input.addEventListener("change", () => save({ targetLang: code }));
    label.append(input, name);
    box.append(label);
  }
}


function renderTargetCurrency(current) {
  const select = document.getElementById("targetCurrency");
  for (const code of TARGET_CURRENCIES) select.add(new Option(currencyLabel(code), code));
  select.value = current;
  select.addEventListener("change", () => save({ targetCurrency: select.value }));
}


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


function renderUnits(settings) {
  const presetBox = document.getElementById("unitPresets");
  const prefBox = document.getElementById("unitPrefs");
  const selects = {};

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
      await save({ [key]: select.value });
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
      await save(values);
      markPreset();
    });
    presetButtons[name] = button;
    presetBox.append(button);
  }
  markPreset();
}


function renderWordWrapper(current) {
  const box = document.getElementById("wordWrapper");
  box.checked = current;
  box.addEventListener("change", () => save({ wordWrapper: box.checked }));
}

function renderPopupDelay(current) {
  const input = document.getElementById("popupDelay");
  input.value = current;
  input.addEventListener("change", () => {
    const value = Math.min(MAX_POPUP_DELAY, Math.max(0, Math.round(Number(input.value) || 0)));
    input.value = value;
    save({ popupDelay: value });
  });
}


function renderSites(blockedSites) {
  const list = document.getElementById("blockedSites");
  list.replaceChildren();
  if (!blockedSites.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No sites switched off.";
    list.append(empty);
    return;
  }
  for (const site of [...blockedSites].sort()) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = site;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      const { blockedSites: current } = await getSettings();
      await save({ blockedSites: current.filter((s) => s !== site) });
    });
    item.append(name, remove);
    list.append(item);
  }
}

function setUpAddSite() {
  const form = document.getElementById("addSite");
  const input = document.getElementById("newSite");
  const error = document.getElementById("siteError");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const site = siteOf(input.value);
    if (!site) {
      error.textContent = `“${input.value}” isn't a site address.`;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    const { blockedSites } = await getSettings();
    if (!blockedSites.includes(site)) await save({ blockedSites: [...blockedSites, site] });
    input.value = "";
  });
}

// Another open settings tab may change the list.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blockedSites) renderSites(changes.blockedSites.newValue ?? []);
});

getSettings().then((settings) => {
  renderTargetLang(settings.targetLang);
  renderTargetCurrency(settings.targetCurrency);
  renderUnits(settings);
  renderRates();
  renderWordWrapper(settings.wordWrapper);
  renderPopupDelay(settings.popupDelay);
  renderSites(settings.blockedSites);
  setUpAddSite();
});
