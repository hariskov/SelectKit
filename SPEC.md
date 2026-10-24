# SelectKit — Floorp/Firefox extension spec

Helps with text selection: completes partial selections to whole words, sends
text to Google Translate, and converts prices and units.

Target browser: Floorp 12+ (Firefox-based, WebExtensions, Manifest V3).

## F1 — Word wrapper (selection completion)

When a mouse selection ends, every word the selection touches is selected in
full. Selecting `ect all wor` in "select all words" becomes `select all words`.

- Word boundaries come from `Intl.Segmenter` (granularity `word`), so it works
  for any script: Latin, Cyrillic, Arabic/Hebrew (RTL), and languages without
  spaces such as Chinese, Japanese and Thai (dictionary-based word breaks).
- Only an edge that falls *inside* a word moves; edges already on a boundary,
  or on whitespace/punctuation, stay put.
- Selection direction (anchor/focus) is preserved.
- Selections inside `<input>`/`<textarea>` and editable regions are left alone.
- Can be switched off in the settings.

## F2 — Translation (new tab)

Any text selection shows a small popup next to the mouse cursor with a
**Translate** button. Clicking it opens a new tab, right after the current one:

```
https://translate.google.com/?sl=auto&tl=<target>&text=<selection>&op=translate
```

- Works from **any source language**: `sl=auto` lets Google detect it, so the
  user never picks a source language.
- `<target>` is set in the settings: English (`en`, default) or Bulgarian (`bg`).
- Text is cut to fit both Google Translate's 5,000-character limit and its
  URL size limit (requests over ~16 KB get HTTP 400; non-Latin text costs up
  to 9 URL characters per character, so Japanese fits ~1,300 characters).
  The cut is made at a sentence or word boundary, and the full text is copied
  to the clipboard.
- Only from the popup: no context-menu entry (Floorp already has its own
  "Translate selection") and no keyboard shortcut, both by choice.

## F3 — Conversion

The popup shows a conversion result when the selection is a price or a
measurement.

### Currency: any currency → EUR, USD, RON or BGN (default EUR)
- **Source: any currency, written any common way.** Each currency is
  recognised by its ISO 4217 code *and* its symbols/local names. Codes come
  from ISO 4217; symbols come from Unicode CLDR (the data behind the browser's
  `Intl` API), read at runtime, so the list doesn't have to be kept by hand.
  CLDR misses some everyday forms (`лв`/`лева`, `грн`, `lei` for MDL), so a
  short list of extra names lives in `lib/currencies.js`. These all mean the
  same currency:

  | Currency | Recognised as |
  |---|---|
  | BGN | `BGN`, `лв`, `лв.`, `лева`, `lv` |
  | RON | `RON`, `lei`, `leu` |
  | EUR | `EUR`, `€`, `euro`, `евро` |
  | USD | `USD`, `US$`, `$`* |
  | PLN | `PLN`, `zł` |
  | CZK | `CZK`, `Kč` |
  | HUF | `HUF`, `Ft` |
  | RSD | `RSD`, `din`, `дин` |
  | MKD | `MKD`, `ден` |
  | UAH | `UAH`, `₴`, `грн` |
  | TRY | `TRY`, `₺`, `TL` |
  | GEL | `GEL`, `₾` |
  | INR | `INR`, `₹`, `Rs`* |
  | … | every other ISO code, plus `£ ¥ ₩ ₽ ₪ ₫ ₱ ฿ R$ C$ A$ HK$ CHF kr RM Rp` |

- Codes and names match case-insensitively (`ron`, `Lei`, `ЛВ`), before or
  after the number, with or without a space (`12лв`, `lei 50`, `50 RON`).
- `*` = ambiguous: the same symbol is used by several currencies (in CLDR,
  `$` is used by 29 currencies, `£` by 6, `kr` and `Rs` by 4 each).
- **Target:** EUR (default), USD, RON or BGN, chosen in the settings. The
  list is one constant (`TARGET_CURRENCIES`), so adding more later is easy.
- Number parsing handles `1,234.56`, `1.234,56`, `1 234,56`, `1'234.56` and
  Indian grouping `1,23,456`.
- Ambiguous symbols are resolved automatically, with no settings:
  1. the page's language/region: `<html lang="en-CA">` → `$` = CAD
  2. the site's country domain: `.com.au` → AUD, `.no` → `kr` = NOK
  3. otherwise the most widely used currency for that symbol
     (`$` USD, `£` GBP, `¥` JPY, `kr` SEK, `Rs` INR, `lei` RON)
- The popup shows which currency it assumed, e.g. "$19.99 (CAD) ≈ 13.20 €".
  Clicking the currency lets you pick another one for that selection.
- Rates, fetched at most once a day and cached in `storage.local`; the result
  shows the rate date:
  1. ECB reference rates via `api.frankfurter.app` (official, ~30 major currencies)
  2. Fallback for currencies the ECB doesn't cover: `fawazahmed0/exchange-api`
     (free, no key, 200+ currencies, served from jsDelivr)
- BGN ↔ EUR uses the fixed rate 1.95583 (euro adopted 2026-01-01), no fetch.
- If the price is already in the target currency, no conversion is shown.

### Units → metric (local, no network)
- Length: in, ft, yd, mi → cm / m / km
- Mass: oz, lb, st (stone, incl. `11 st 4 lb`) → g / kg
- Volume: fl oz, US gal → ml / l
- Temperature: °F → °C
- Speed: mph → km/h

## F4 — Popup

- Appears on every non-empty text selection, at the mouse position.
- Contents: `Translate → EN|BG`, conversion result (when detected), `Copy`.
- Closes on Esc, scroll, or a click outside it.
- Rendered inside a Shadow DOM so page CSS can't affect it.

## F5 — Settings (options page)

| Setting | Values | Default |
|---|---|---|
| Translation target | English / Bulgarian | English |
| Target currency | EUR / USD / RON / BGN | EUR |
| Word wrapper | on / off | on |

## Non-goals (v1)

In-page translation, the built-in PDF viewer (content scripts can't run there),
history, sync between devices.

## Architecture

```
manifest.json        MV3; background uses "scripts" (Firefox event page)
background.js        opens translate tabs, rate fetch/cache
content/selection.js word completion (Intl.Segmenter + Range API)
content/detect.js    price and unit parsing + conversion  (phase 4–5)
content/popup.js     Shadow-DOM popup at the mouse
options/             settings page
```

All network access happens in the background script; content scripts talk to it
with `runtime.sendMessage`.

## Plan

See [PLAN.md](PLAN.md): phases that are each built, run and tested on their own.
