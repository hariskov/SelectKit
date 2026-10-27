# SelectKit

A [Floorp](https://floorp.app) / Firefox extension that helps with selected
text. Select something and a small popup appears next to the cursor.

- **Word wrapper:** partly selected words get selected in full
  (`ect all wor` → `select all words`), in any language.
- **Translate:** opens the selection in Google Translate in a new tab. Any
  source language; translates to English or Bulgarian.
- **Prices:** any currency (`$19.99`, `50 lei`, `12 лв`, `VND 250000`) converted
  to EUR, USD, RON or BGN with current exchange rates. Ambiguous symbols like
  `$` or `kr` are matched to the page's country, and you can switch them.
- **Measurements:** length, weight, temperature, volume, speed and fuel
  economy (mpg ↔ L/100 km) converted to your units: metric, US or UK, set per
  kind of measurement.
- **Copy:** copies the selection, or a converted value with one click.

The toolbar icon shows the version and opens the settings, where sites can
also be switched off.

**Version 1.0.0.**

## Install

Until it's signed by Mozilla, load it as a temporary add-on (it stays until
Floorp restarts):

1. Download or clone this repository.
2. Open `about:debugging#/runtime/this-firefox`.
3. **Load Temporary Add-on…** → choose `manifest.json`.

## Settings

| Setting | Default |
|---|---|
| Translate to | English (or Bulgarian) |
| Convert prices to | EUR (or USD, RON, BGN) |
| Units | Metric; one-click US or UK presets, or per kind of measurement |
| Word wrapper | on |
| Popup delay | 0 ms |
| Sites switched off | none |

## Development

Requirements: Node.js and Floorp. The scripts assume the Floorp
flatpak (`one.ablaze.floorp`). For a regular install, change `--firefox=` in
`package.json` to the binary path.

```sh
npm install
npm start            # opens a separate Floorp window with the extension
```

The first `npm start` takes about 45 seconds before Floorp shows up. It uses a
throwaway profile, so your normal browser profile isn't touched. The
extension reloads when files change. If a change doesn't show up, use
`about:debugging` → *This Floorp* → SelectKit → *Reload*.

```sh
npm run lint         # web-ext lint, must be clean
npm test             # all tests (node --test)
npm run gen:currencies  # regenerate lib/currency-data.js from CLDR
```

To try it in your normal Floorp instead: `about:debugging` → *This Floorp* →
*Load Temporary Add-on…* → `manifest.json`. It stays until Floorp restarts.

## Project layout

```
manifest.json        extension manifest (MV3)
background.js        background script: translate tabs, exchange rates
panel/               toolbar panel: on/off for the current site
content/             content scripts: popup at the mouse, Word wrapper
test/*.test.js       tests (npm test): logic, background, content scripts
                     and extension pages (the last two in jsdom)
lib/settings.js      settings defaults and storage helpers
lib/translate.js     Google Translate links and length limits
lib/words.js         word boundaries for the Word wrapper
lib/patterns.js      regex helpers shared by units and currencies
lib/numbers.js       reading written numbers (1,234.5 · 1.234,5)
lib/units.js         finding and converting measurements
lib/currencies.js    finding and converting prices
lib/currency-data.js currency codes and symbols from CLDR (generated)
lib/rates.js         downloading and caching exchange rates
scripts/             npm run gen:currencies
options/             settings page
icons/               toolbar icon
```

## Privacy

SelectKit collects nothing. Text is only sent to Google Translate when you
click *Translate*, and exchange rates are fetched from public rate services
(ECB via Frankfurter, and exchange-api) about once a week. Settings are kept
in the browser's extension storage, which follows Firefox Sync if you use it.

## License

[GPL-3.0](LICENSE)
