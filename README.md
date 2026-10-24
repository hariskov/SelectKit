# SelectKit

A [Floorp](https://floorp.app) / Firefox extension that helps with selected text:

- **Word wrapper:** partly selected words get selected in full
  (`ect all wor` → `select all words`), in any language.
- **Translates:** a popup next to the cursor opens the selection in Google
  Translate, in a new tab. Any source language; target is English or Bulgarian.
- **Converts:** prices in any currency (`$19.99`, `50 lei`, `12 лв`, `VND 250000`)
  to EUR, USD, RON or BGN, and imperial units (ft, mi, lb, stone,
  °F, gal, mph) to metric.

> **Status:** early development, built in phases (see [PLAN.md](PLAN.md)).
> Done so far: skeleton, settings page, popup at the mouse, translation, Word wrapper (phases 0–4). Not usable for
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
