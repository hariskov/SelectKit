# SelectKit

A [Floorp](https://floorp.app) / Firefox extension that helps with selected text:

- **Word wrapper:** partly selected words get selected in full
  (`ect all wor` → `select all words`), in any language.
- **Translates:** a popup next to the cursor opens the selection in Google
  Translate, in a new tab. Any source language; target is English or Bulgarian.
- **Converts:** prices in any currency (`$19.99`, `50 lei`, `12 лв`, `VND 250000`)
  to EUR, USD, RON or BGN, and measurements (length, weight, temperature,
  volume, speed, fuel economy incl. mpg ↔ L/100 km) to your preferred units:
  metric, US or UK, set per kind of measurement.

> **Status:** early development, built in phases (see [PLAN.md](PLAN.md)).
> All features are in (phases 0–6): Word wrapper, translation, unit and currency conversion. Next: polish, then a signed install. Not usable for
> everyday browsing yet.

## Development

Requirements: Node.js, Python 3, and Floorp. The scripts assume the Floorp
flatpak (`one.ablaze.floorp`). For a regular install, change `--firefox=` in
`package.json` to the binary path.

```sh
npm install
npm run playground   # terminal 1: serves test/playground.html on :8000
npm start            # terminal 2: opens a separate Floorp window with the extension
```

The first `npm start` takes about 45 seconds before Floorp shows up. It uses a
throwaway profile, so your normal browser profile isn't touched. The
extension reloads when files change. If a change doesn't show up, use
`about:debugging` → *This Floorp* → SelectKit → *Reload*.

```sh
npm run lint         # web-ext lint, must be clean
npm test             # unit tests for the pure logic (node --test)
npm run gen:currencies  # regenerate lib/currency-data.js from CLDR
```

To try it in your normal Floorp instead: `about:debugging` → *This Floorp* →
*Load Temporary Add-on…* → `manifest.json`. It stays until Floorp restarts.

## Project layout

```
manifest.json        extension manifest (MV3)
background.js        background script
content/             content scripts: popup at the mouse, Word wrapper
test/*.test.js       unit tests (npm test)
lib/settings.js      settings defaults and storage helpers
lib/translate.js     Google Translate links and length limits
lib/words.js         word boundaries for the Word wrapper
lib/numbers.js       reading written numbers (1,234.5 · 1.234,5)
lib/units.js         finding and converting measurements
lib/currencies.js    finding and converting prices
lib/currency-data.js currency codes and symbols from CLDR (generated)
lib/rates.js         downloading and caching exchange rates
scripts/             npm run gen:currencies
options/             settings page
icons/               toolbar icon
test/playground.html manual test page, one section per phase
SPEC.md              what the extension does
PLAN.md              phases and their test checklists
```

## Privacy

SelectKit collects nothing. Text is only sent to Google Translate when you
click *Translate*, and exchange rates are fetched from public rate services
(ECB via Frankfurter, and exchange-api).

## License

[GPL-3.0](LICENSE)
