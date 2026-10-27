# SelectKit — development plan

Each phase ends with something that runs in Floorp and a checklist to test.
Don't start the next phase until the current checklist passes.

## How we run and test

- **Run:** `npm run playground` in one terminal, `npm start` in another.
  This launches the Floorp flatpak with a throwaway profile and the extension
  loaded, opens the playground, and reloads the extension when files change.
  The first launch takes ~45 s before "Installed … as a temporary add-on"
  appears. Fallback: `about:debugging` → *This Floorp* →
  *Load Temporary Add-on…* → `manifest.json`.
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
- [x] `npm run start` opens Floorp with the extension loaded
- [x] Icon shows in the toolbar; no errors in `about:debugging` → Inspect
- [x] `npm run lint` is clean

## Phase 1 — Settings
Options page: translate target (EN/BG), target currency (dropdown: EUR, USD, RON,
BGN), "Word wrapper" toggle. Toolbar icon opens it.

Test:
- [x] Clicking the icon opens settings in a tab; defaults are EN / EUR / Word wrapper on
- [x] Target currency dropdown offers exactly EUR, USD, RON, BGN
- [x] Every change shows "Saved"
- [x] Changed values are still there after reloading the extension (about:debugging → Reload)
- [x] Settings page is readable in both light and dark mode

## Phase 2 — Popup at the mouse (Copy only)
Shadow-DOM popup appears after any text selection, next to the cursor, with a
single **Copy** button.

Test:
- [x] Select text on the playground and on 3 real sites (Wikipedia, GitHub, a news site) → popup appears at the mouse
- [x] Copy puts the text on the clipboard
- [x] Hides on Esc, scroll, click outside, and when the selection is cleared
- [x] Near the right/bottom edge it stays inside the window
- [x] Clicking the popup doesn't lose the page selection
- [x] Page CSS doesn't change its look (playground "hostile CSS" section)
- [x] Works inside an iframe
- [x] Double-click and triple-click also show it
- [x] Selecting inside an input/textarea shows no popup

## Phase 3 — Translate in a new tab
**Translate → EN/BG** button in the popup. (A context-menu entry and a
keyboard shortcut were built, then removed at the user's request: Floorp
already has its own "Translate selection" menu item.)

Test:
- [x] Any source language works with no setup (`sl=auto`): Japanese, Chinese, Korean, Arabic (RTL), Hebrew, Russian, German, Spanish, Turkish, Hindi → new tab right after the current one with `tl=en` and the text filled in
- [x] Mixed-language selection (e.g. English sentence with a Japanese name) still opens correctly
- [x] Switch setting to Bulgarian → button label and tab use `tl=bg`, no reload needed
- [x] Text > 5000 chars: tab gets a truncated part ending at a sentence, full text is on the clipboard
- [x] Long non-Latin text (Japanese ~3300 chars) is cut to fit Google's URL limit (~1300 chars) and still opens
- [x] Text with `&`, `#`, `?`, newlines and emoji arrives intact
- [x] Unit tests for truncation pass

## Phase 4 — Word wrapper
Partly selected words at either edge get selected in full.

Test:
- [x] `ect all wor` → `select all words` (dragging left→right)
- [x] Same, dragging right→left; shift+arrow afterwards extends in the expected direction
- [x] Edges already on a word boundary or on spaces/punctuation don't move
- [x] Double-click and triple-click behave exactly as before
- [x] Bulgarian text (`ктирай всич` → `селектирай всички`)
- [x] Languages without spaces (Japanese, Chinese, Thai) snap to dictionary words and don't jump wildly
- [x] RTL text (Arabic, Hebrew) and accented Latin (`Straße`, `café`, `naïve`) complete correctly
- [x] Words split by markup (`im<b>port</b>ant`) complete across the tags
- [x] Popup Copy/Translate use the completed selection
- [ ] Added after 1.0 review: double-click or drag into a price or measurement selects all of it (`$25`, `25 лв`, `5 ft 11 in`)
- [x] Selections in inputs/textareas/editors are never changed
- [x] Toggle off in settings → no snapping
- [x] Unit tests for word boundaries pass

## Phase 5 — Unit conversion (offline) + unit preferences
Popup shows the converted value when the selection contains a measurement.
Settings get a Units section: one preference per kind of measurement, plus
Metric / US / UK buttons.

Test (each selected on its own and inside a sentence), with metric settings:
- [x] `5 ft 11 in` → 180 cm · `6'2"` → 188 cm
- [x] `3 miles` / `26.2 mi` → km · `12 inches` → cm · `10 yd` → m
- [x] `180 lb` / `180 lbs` → 81.6 kg · `11 st 4 lb` → 71.7 kg · `8 oz` → 227 g
- [x] `72°F` / `72 F` / `-40 °F` → °C
- [x] `1 gallon` → 3.79 L · `12 fl oz` → 355 ml · `60 mph` → 97 km/h
- [x] `35 mpg` → 6.7 L/100 km (US); same on a UK page → 8.1 L/100 km (UK)
- [x] Metric values (`180 cm`, `5 L/100 km`, `20 °C`) show nothing

With other settings:
- [x] US button → `180 cm` → 5 ft 11 in · `20 °C` → 68 °F · `6.7 L/100 km` → 35.1 mpg
- [x] UK button → `80 kg` → 12 st 8 lb · `5 L/100 km` → 56.5 mpg (UK)
- [x] Changing a preference applies to the next selection without reloading

Robustness:
- [x] Ordinary text (`5 friends`, `in 2024`, `5 in a row`, `21st`, `the 90's`, `5G`) shows no conversion
- [x] A sentence with two measurements shows both
- [x] Clicking a result copies it
- [x] Unit tests for the parser and conversions pass (most coverage lives here)

## Phase 6 — Currency with live rates
Price detection and conversion to the target currency (EUR / USD / RON / BGN),
with real exchange rates. (Originally split into "fixed rates" and "live
rates" phases; merged so no hardcoded rates ever ship.)

- Rates: ECB reference rates via Frankfurter, plus `fawazahmed0/exchange-api`
  for currencies the ECB doesn't publish. Fetched when first needed, cached in
  `storage.local`, refreshed when older than 7 days. BGN is always the fixed
  1.95583 per euro.
- Symbols and local names come from CLDR, generated into
  `lib/currency-data.js` by `npm run gen:currencies`, plus a short list of
  extras (`лв`, `лева`, `грн`, `lei`, …).
- Unit tests use a fixed set of test rates; the extension never does.

Test, detection:
- [x] `$19.99`, `USD 40`, `40 USD`, `£5`, `¥1,200`, `CHF 12.50`
- [x] Other symbols: `₹1,23,456`, `₩50,000`, `₺250`, `R$ 99,90`, `150 zł`, `299 Kč`
- [x] Any ISO code: `VND 250000`, `40 TRY`, `AED 100`
- [x] Symbol and ISO code give the same result: `50 RON` = `50 lei` = `50 Lei`; `12 BGN` = `12 лв` = `12лв.` = `12 лева`; `100 UAH` = `100 грн` = `₴100`
- [x] Lower-case codes count when the selection is just the price: `ron 50`, `50ron`, `lei 50` (but `5 try` / `10 cup` inside a sentence don't; codes that are English words like `try`, `top` only in upper case)
- [x] `1.299,00 лв` and `12,50 лв.` → EUR via the fixed rate
- [x] `1,234.56`, `1.234,56`, `1 234,56` and `1'234.56` all parse correctly
- [x] Words that only look like aliases don't trigger: `TL;DR`, `lv 5 armor`, `Ft. Worth`

Test, ambiguous symbols:
- [x] Popup names the assumed currency: `50 lei (RON) ≈ …`, `$20 (USD) ≈ …`
- [x] Resolved from the page: `$20` under `lang="en-CA"` → CAD; on a `.com.au` site → AUD; `kr` under `lang="nb"` → NOK
- [x] Clicking the assumed currency switches to the next likely one (e.g. `$` USD → CAD → AUD …)

Test, conversion and rates:
- [x] Change target currency to USD, RON or BGN → results switch, no reload needed
- [x] Prices already in the target currency show no conversion
- [x] First conversion fetches rates; later ones don't (background Network tab), until they're 7 days old
- [x] ECB currency (USD, GBP, JPY) uses the ECB rate; non-ECB (VND, AED, ARS) the exchange-api rate
- [x] Cross-rate when neither side is EUR (TRY → USD) is correct
- [x] Settings show the rates' date and source, with a **Refresh now** button
- [ ] Offline with a cache: still converts; offline with no cache: no price result, nothing breaks
- [x] Unknown currency: no conversion instead of a wrong one
- [x] Unit tests for detection and conversion pass

## Phase 7 — Polish → version 1.0.0
- Popup follows the system light/dark theme.
- "Don't use on this site": a Sites list in settings (add a site, Remove).
  (A per-site switch in the toolbar panel was built, then dropped at the
  user's request in favour of the list.)
- Toolbar panel becomes an About box: version, release date, rates' date,
  Settings button, GitHub link.
- Popup delay setting in milliseconds, default 0 (immediate, as before).
- Version 1.0.0, README for users. (The icon stays as it is.)

Test:
- [x] Popup is light with a light system theme, dark with a dark one; switches without reloading
- [x] Settings → Sites: add a site → no popup and no Word wrapper there (after the next selection, no reload); Remove → works again
- [x] Subdomains follow: `example.com` also covers `www.example.com`
- [x] Toolbar icon → About panel: version 1.0.0 and date, rates' date, Settings button, GitHub link
- [x] Popup delay 0 → immediate; 500 → appears half a second later; starting a new drag or click before then cancels it
- [x] Word wrapper still adjusts the selection immediately, whatever the delay

## Phase 8 — Permanent install
Sign as **unlisted** on addons.mozilla.org (`web-ext sign --channel=unlisted`,
needs free AMO API keys) and install the `.xpi`.

Test:
- [ ] Installed from the `.xpi`, still there after restarting Floorp
- [ ] Settings carried over
