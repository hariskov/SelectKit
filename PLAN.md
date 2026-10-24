# SelectKit — development plan

Each phase ends with something that runs in Floorp and a checklist to test.
Don't start the next phase until the current checklist passes.

## How we run and test

- **Run:** `npx web-ext run --firefox=flatpak:one.ablaze.floorp` (Floorp is a
  flatpak here; verified in phase 0). Fallback: `about:debugging` →
  *This Floorp* → *Load Temporary Add-on…* → `manifest.json`.
- **Manual tests:** `test/playground.html`. It gets a new section for each
  phase (sample text, Japanese/Bulgarian text, prices, units, an iframe, a page
  with aggressive CSS). Serve it with `python -m http.server -d test 8000`.
- **Unit tests:** pure logic (truncation, word boundaries, unit/price parsing)
  is kept free of the DOM so it runs with `node --test test/`.
- **Lint:** `npx web-ext lint` must be clean at the end of every phase.
- **Commit** at the end of every phase.

---

## Phase 0 — Skeleton loads
Manifest, icon, empty background script, `test/playground.html`, `package.json`
with `run` / `lint` / `test` scripts.

Test:
- [ ] `npm run start` opens Floorp with the extension loaded
- [ ] Icon shows in the toolbar; no errors in `about:debugging` → Inspect
- [ ] `npm run lint` is clean

## Phase 1 — Settings
Options page: translate target (EN/BG), target currency, `$`/`¥` meaning,
"complete words" toggle. Toolbar icon opens it.

Test:
- [ ] Clicking the icon opens settings; defaults are EN / EUR / USD / JPY / on
- [ ] Changed values are still there after reloading the extension
- [ ] Settings page is usable in dark mode

## Phase 2 — Popup at the mouse (Copy only)
Shadow-DOM popup appears after any text selection, next to the cursor, with a
single **Copy** button.

Test:
- [ ] Select text on the playground and on 3 real sites (Wikipedia, GitHub, a news site) → popup appears at the mouse
- [ ] Copy puts the text on the clipboard
- [ ] Hides on Esc, scroll, click outside, and when the selection is cleared
- [ ] Near the right/bottom edge it stays inside the window
- [ ] Clicking the popup doesn't lose the page selection
- [ ] Page CSS doesn't change its look (playground "hostile CSS" section)
- [ ] Works inside an iframe

## Phase 3 — Translate in a new tab
**Translate → EN/BG** button, right-click menu entry, `Alt+Shift+T`.

Test:
- [ ] Any source language works with no setup (`sl=auto`): Japanese, Chinese, Korean, Arabic (RTL), Hebrew, Russian, German, Spanish, Turkish, Hindi → new tab right after the current one with `tl=en` and the text filled in
- [ ] Mixed-language selection (e.g. English sentence with a Japanese name) still opens correctly
- [ ] Switch setting to Bulgarian → button label and tab use `tl=bg`, no reload needed
- [ ] Right-click → "Translate “…” → EN" works; menu label follows the setting
- [ ] `Alt+Shift+T` works with a selection; does nothing without one
- [ ] Text > 5000 chars: tab gets a truncated part, full text is on the clipboard
- [ ] Text with `&`, `#`, `?`, newlines and emoji arrives intact
- [ ] Unit tests for truncation pass

## Phase 4 — Word completion
Partly selected words at either edge get selected in full.

Test:
- [ ] `ect all wor` → `select all words` (dragging left→right)
- [ ] Same, dragging right→left; shift+arrow afterwards extends in the expected direction
- [ ] Edges already on a word boundary or on spaces/punctuation don't move
- [ ] Double-click and triple-click behave exactly as before
- [ ] Bulgarian text (`ктирай всич` → `селектирай всички`)
- [ ] Languages without spaces (Japanese, Chinese, Thai) snap to dictionary words and don't jump wildly
- [ ] RTL text (Arabic, Hebrew) and accented Latin (`Straße`, `café`, `naïve`) complete correctly
- [ ] Selections in inputs/textareas/editors are never changed
- [ ] Toggle off in settings → no snapping
- [ ] Unit tests for word boundaries pass

## Phase 5 — Unit conversion (offline)
Popup shows the metric result when the selection is a measurement.

Test (each selected on its own and inside a sentence):
- [ ] `5 ft 11 in` → 180 cm · `6'2"` → 188 cm
- [ ] `3 miles` / `26.2 mi` → km · `12 inches` → cm · `10 yd` → m
- [ ] `180 lb` / `180 lbs` → 81.6 kg · `11 st 4 lb` → 71.7 kg · `8 oz` → 227 g
- [ ] `72°F` / `72 F` / `-40 °F` → °C
- [ ] `1 gallon` → 3.79 l · `12 fl oz` → 355 ml · `60 mph` → 97 km/h
- [ ] Ordinary text (`5 friends`, `in 2024`) shows no conversion
- [ ] Unit tests for the parser pass (most coverage lives here)

## Phase 6 — Currency with fixed rates
Price detection and parsing, converting with the BGN fixed rate (1.95583) and a
hardcoded rate table, so parsing can be tested separately from the network.

Test:
- [ ] `$19.99`, `USD 40`, `40 USD`, `£5`, `¥1,200`, `CHF 12.50`
- [ ] Other symbols: `₹1,23,456`, `₩50,000`, `₺250`, `R$ 99,90`, `150 zł`, `299 Kč`
- [ ] Any ISO code: `VND 250000`, `40 TRY`, `AED 100`
- [ ] Symbol and ISO code give the same result: `50 RON` = `50 lei` = `50 Lei`; `12 BGN` = `12 лв` = `12лв.` = `12 лева`; `100 UAH` = `100 грн` = `₴100`
- [ ] Codes match in any case and on either side: `ron 50`, `50ron`, `lei 50`
- [ ] Popup names the assumed currency: `50 lei (RON) ≈ … €`
- [ ] `lei` = MDL setting → `50 lei (MDL)`
- [ ] `1.299,00 лв` and `12,50 лв.` → EUR via the fixed rate
- [ ] `1,234.56`, `1.234,56`, `1 234,56` and `1'234.56` all parse correctly
- [ ] `$`, `¥`, `kr`, `lei` and `Rs` follow the settings (e.g. `$` = CAD)
- [ ] Words that only look like aliases don't trigger: `TL;DR`, `lv 5 armor`, `Ft. Worth` (no number next to them, or a clearly non-price context)
- [ ] Change target currency to USD → results switch to USD, no reload needed
- [ ] Prices already in the target currency show no conversion
- [ ] Unit tests for the price parser pass

## Phase 7 — Live rates
Background fetches ECB rates from `api.frankfurter.app` at most once a day,
with `fawazahmed0/exchange-api` as the fallback for currencies the ECB doesn't
cover. Cached in `storage.local`; the result shows the rate date and source.
The settings page's target-currency list is filled from the available rates.

Test:
- [ ] First conversion fetches rates; later ones within the day don't (Network tab)
- [ ] ECB currency (USD, GBP, JPY) uses the ECB rate
- [ ] Non-ECB currency (VND, AED, ARS) uses the fallback rate
- [ ] Cross-rate when neither side is EUR (e.g. TRY → USD) is correct
- [ ] Offline with a cache: still converts, shows the old date
- [ ] Offline with no cache: popup says "rates unavailable" and nothing breaks
- [ ] Unknown currency: shows no conversion instead of a wrong one

## Phase 8 — Polish
Dark/light popup that follows the system, a site blocklist in settings, a
small delay so the popup doesn't flicker while dragging, an icon at all sizes.

Test:
- [ ] One full day of normal browsing without the popup getting in the way
- [ ] Blocklisted site → no popup, no snapping

## Phase 9 — Permanent install
Sign as **unlisted** on addons.mozilla.org (`web-ext sign --channel=unlisted`,
needs free AMO API keys) and install the `.xpi`.

Test:
- [ ] Installed from the `.xpi`, still there after restarting Floorp
- [ ] Settings carried over
