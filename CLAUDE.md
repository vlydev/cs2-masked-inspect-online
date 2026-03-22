# CLAUDE.md — cs2-masked-inspect-online

A single-page web app for decoding CS2 masked inspect URLs. Deployed via GitHub Pages.
Repository: `https://github.com/vlydev/cs2-masked-inspect-online`

## Stack

- **Pico CSS v2** (classless, CDN) — automatic light/dark theme via `data-theme="auto"`
- **Alpine.js v3** (CDN, defer) — reactivity via `x-data="decoder()"`
- **cs2-masked-inspect-js** — author's own library, loaded as an IIFE bundle from GitHub Releases

## Parsing Library

```html
<script src="https://github.com/vlydev/cs2-masked-inspect-js/releases/download/v1.1.1/cs2-masked-inspect.min.js"></script>
```

Exposes global `Cs2MaskedInspect`:
```js
const { InspectLink, toGenCode, genCodeFromLink } = Cs2MaskedInspect;
```

When a new library version is released — update the version in the URL.

The bundle is built via `npm run build` in `cs2-masked-inspect-js` using esbuild with a Buffer polyfill.
On release, GitHub Actions automatically builds and attaches `.min.js` to the release assets.

## File Structure

```
index.html          — entire project in one file (HTML + CSS + JS)
.github/
  workflows/
    deploy.yml      — deploy to GitHub Pages on push to main
```

## Alpine.js Component `decoder()`

All state and logic lives in `Alpine.data('decoder', ...)`.

### State

| Field | Description |
|---|---|
| `url` | Current URL in the input (x-model) |
| `result` | `ItemPreviewData` after decode, null if none |
| `genCode` | !gen code string |
| `error` | Error message |
| `imgPopup` | `{url, alt, x, y}` — hover popup state for large image |
| `_skinCache` | `Map<paintIndex, {name, image}>` — lazy, from skins_not_grouped.json |
| `_stickerCache` | `Map<id, {name, image}>` — lazy, stickers.json + patches.json combined |
| `_keychainCache` | `Map<id, {name, image}>` — lazy, keychains.json |

### LocalStorage Cache

Keys: `cs2_skins_v1`, `cs2_stickers_v1`, `cs2_keychains_v1`.
Format: `{ fetchedAt: timestamp, entries: [[id, {name, image}], ...] }`.
TTL: 24 hours. Expired entries are deleted and re-fetched on next use.

### Data Sources (ByMykel CSGO-API)

```
https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/stickers.json
https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/patches.json
https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/keychains.json
https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/skins_not_grouped.json
```

- Stickers and patches are merged into one Map (impossible to distinguish in inspect data)
- `skins_not_grouped.json`: each combination of weapon+paint+variant has 5 wear entries; only FN is kept, wear suffix stripped from name
- Cache key: `"${weapon_id}_${paint_index}_${suffix}"` where suffix = `st` (stattrak), `sv` (souvenir), `normal`
- `paint_index` in JSON is a string; in inspect data it's a number
- Lookup suffix derived from `result.quality`: 9 → `st`, 12 → `sv`, else → `normal`

## Decode Logic

### Regular skin (weapon)
- `paintIndex > 0` — look up skin in `_skinCache`
- Show: type, quality, rarity, skin (img+name), defIndex, paintIndex, paintSeed, paintWear
- If quality=4 (StatTrak™) — show kill counter value

### Direct item (sticker / patch / keychain)
Condition: `paintIndex=0` AND `paintSeed=0` AND (`stickers.length=1` OR `keychains.length=1`).

- Show item as skin row (img+name from stickerCache / keychainCache)
- Hide Stickers and Keychains sections — no duplication
- Hide `quality` row (always Normal, not meaningful)
- Hide StatTrak Kills row

### Rarity Mapping

For **weapon skins**:
| # | Name |
|---|---|
| 1 | Consumer Grade |
| 2 | Industrial Grade |
| 3 | Mil-Spec |
| 4 | Restricted |
| 5 | Classified |
| 6 | Covert |
| 7 | Contraband |

For **stickers / patches / keychains** (same numbers, different names):
| # | Name |
|---|---|
| 3 | High Grade |
| 4 | Remarkable |
| 5 | Exotic |
| 6 | Extraordinary |
| 7 | Contraband |

### Quality Mapping (weapon skins only)

| # | Name |
|---|---|
| 0 | Normal |
| 3 | Souvenir |
| 4 | StatTrak™ |
| 9 | ★ |

## Stickers on Weapons

Table columns: Slot | [img] Name / #id / meta | Wear

`meta` — extra params shown as small tags if non-null/non-zero: `scale`, `rotation`, `offset X,Y`, `offsetZ`, `tintId`, `pattern`.

## Image Hover Popup

`showImgPopup(e, {name, image})` — positions a `position:fixed` div near the cursor (180×180px).
Automatically flips left/up if it would overflow the viewport edge.
`x-cloak` on the popup element prevents flash on Alpine init.

## Git

Commit author: `VlyDev <vladdnepr1989@gmail.com>` (local git config for this repo).
Branch: `main`.
