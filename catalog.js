'use strict';

// ---------------------------------------------------------------------------
// CS2 Masked Inspect — catalog utilities
// Shared between index.html (browser) and tests (Node.js).
// ---------------------------------------------------------------------------

const CATALOG_URLS = {
  skins:        'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/skins_not_grouped.json',
  stickers:     'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/stickers.json',
  patches:      'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/patches.json',
  keychains:    'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/keychains.json',
  stickerSlabs: 'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/sticker_slabs.json',
  graffiti:     'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/graffiti.json',
  agents:       'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/agents.json',
  keys:         'https://raw.githubusercontent.com/ByMykel/CSGO-API/refs/heads/main/public/api/en/keys.json',
};

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

/**
 * Float wear value → CS2 wear label.
 * @param {number|null} w
 * @returns {string|null}
 */
function wearLabel(w) {
  if (w == null)  return null;
  if (w < 0.07)   return 'Factory New';
  if (w < 0.15)   return 'Minimal Wear';
  if (w < 0.38)   return 'Field-Tested';
  if (w < 0.45)   return 'Well-Worn';
  return 'Battle-Scarred';
}

/**
 * Paint index → Doppler phase name, or null if not a Doppler.
 * @param {number} paintIndex
 * @returns {string|null}
 */
function dopplerPhase(paintIndex) {
  const map = {
    415: 'Ruby', 416: 'Sapphire', 417: 'Black Pearl',
    418: 'Phase 1', 419: 'Phase 2', 420: 'Phase 3', 421: 'Phase 4',
    568: 'Emerald', 569: 'Phase 1', 570: 'Phase 2', 571: 'Phase 3', 572: 'Phase 4',
    617: 'Black Pearl', 618: 'Phase 2', 619: 'Sapphire',
    852: 'Phase 1', 853: 'Phase 2', 854: 'Phase 3', 855: 'Phase 4',
    1119: 'Emerald', 1120: 'Phase 1', 1121: 'Phase 2', 1122: 'Phase 3', 1123: 'Phase 4',
  };
  return map[paintIndex] ?? null;
}

// ---------------------------------------------------------------------------
// Map builders (accept pre-fetched JSON arrays)
// ---------------------------------------------------------------------------

const WEAR_RE = /\s+\((?:Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;

/**
 * Build skin lookup map.
 * Key: "${weapon_id}_${paint_index}_${st|sv|normal}"
 * Value: base name (without wear suffix)
 * @param {Array} items - parsed skins_not_grouped.json
 * @returns {Map<string,string>}
 */
function buildSkinMap(items) {
  const map = new Map();
  items.forEach(item => {
    const pi = Number(item.paint_index);
    const wi = Number(item.weapon?.weapon_id);
    if (!pi || !wi) return;
    const suffix = item.stattrak ? 'st' : item.souvenir ? 'sv' : 'normal';
    const key = `${wi}_${pi}_${suffix}`;
    if (map.has(key)) return; // keep first (FN) entry, which has the cleanest base name
    map.set(key, item.name.replace(WEAR_RE, ''));
  });
  return map;
}

/**
 * Build sticker + patch lookup map.
 * Key: numeric sticker ID (from trailing digits of item.id)
 * Value: full market name
 * @param {Array} stickers - parsed stickers.json
 * @param {Array} patches  - parsed patches.json
 * @returns {Map<number,string>}
 */
function buildStickerMap(stickers, patches) {
  const map = new Map();
  [...stickers, ...patches].forEach(item => {
    const m = item.id?.match(/\d+$/);
    if (m) map.set(Number(m[0]), item.name);
  });
  return map;
}

/**
 * Build keychain lookup map.
 * Key: numeric keychain ID
 * Value: full market name
 * @param {Array} keychains - parsed keychains.json
 * @returns {Map<number,string>}
 */
function buildKeychainMap(keychains) {
  const map = new Map();
  keychains.forEach(item => {
    const m = item.id?.match(/\d+$/);
    if (m) map.set(Number(m[0]), item.name);
  });
  return map;
}

/**
 * Build graffiti lookup map.
 * Key: "${def_index}_${color_index}" (color_index=0 for single-color graffiti)
 * Value: { name, image }
 * @param {Array} graffiti - parsed graffiti.json
 * @returns {Map<string,{name:string,image:string}>}
 */
function buildGraffitiMap(graffiti) {
  const map = new Map();
  graffiti.forEach(item => {
    const key = `${item.def_index}_${item.color_index ?? 0}`;
    map.set(key, { name: item.name, image: item.image });
  });
  return map;
}

/**
 * Build key lookup map.
 * Key: numeric def_index
 * Value: { name, image }
 * @param {Array} keys - parsed keys.json
 * @returns {Map<number,{name:string,image:string}>}
 */
function buildKeyMap(keys) {
  const map = new Map();
  keys.forEach(item => {
    if (item.def_index != null) map.set(Number(item.def_index), { name: item.name, image: item.image });
  });
  return map;
}

/**
 * Build agent lookup map.
 * Key: numeric def_index
 * Value: { name, image }
 * @param {Array} agents - parsed agents.json
 * @returns {Map<number,{name:string,image:string}>}
 */
function buildAgentMap(agents) {
  const map = new Map();
  agents.forEach(item => {
    if (item.def_index != null) map.set(Number(item.def_index), { name: item.name, image: item.image });
  });
  return map;
}

/**
 * Build sticker slab lookup map.
 * Key: numeric def_index (= paintKit in the decoded keychain)
 * Value: { name, image }
 * @param {Array} slabs - parsed sticker_slabs.json
 * @returns {Map<number,{name:string,image:string}>}
 */
function buildStickerSlabMap(slabs) {
  const map = new Map();
  slabs.forEach(item => {
    if (item.def_index != null) map.set(Number(item.def_index), { name: item.name, image: item.image });
  });
  return map;
}

/**
 * Returns true if the decoded item is a Sticker Slab.
 * Sticker Slabs have keychains[0].stickerId === 37 with a non-null paintKit.
 * @param {{ keychains?: Array }} item
 * @returns {boolean}
 */
function isStickerSlab(item) {
  const kc = item.keychains ?? [];
  return kc.length === 1 && kc[0].stickerId === 37 && kc[0].paintKit != null;
}

/**
 * Look up Sticker Slab market name from decoded item.
 * Uses paintKit (proto field 12 in the keychain Sticker sub-message) as the sticker catalog ID.
 * Returns null if the item is not a Sticker Slab or the paintKit is not in the sticker catalog.
 * @param {Map} stickerMap
 * @param {{ keychains?: Array }} item
 * @returns {string|null}
 */
function lookupStickerSlabName(stickerMap, item) {
  if (!isStickerSlab(item)) return null;
  return stickerMap.get(item.keychains[0].paintKit) ?? null;
}

/**
 * Look up skin market name from decoded item properties.
 * Returns full name including wear suffix, or null if not found.
 * @param {Map} skinMap
 * @param {{ defIndex: number, paintIndex: number, quality: number, paintWear: number }} item
 * @returns {string|null}
 */
function lookupSkinName(skinMap, item) {
  const suffix = item.quality === 9 ? 'st' : item.quality === 12 ? 'sv' : 'normal';
  const key    = `${item.defIndex}_${item.paintIndex}_${suffix}`;
  const base   = skinMap.get(key);
  if (!base) return null;
  const phase  = dopplerPhase(item.paintIndex);
  const wear   = wearLabel(item.paintWear);
  const name   = phase ? `${base} (${phase})` : base;
  return wear ? `${name} (${wear})` : name;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/* eslint-disable no-undef */
if (typeof module !== 'undefined' && module.exports) {
  // Node.js / CommonJS
  module.exports = {
    CATALOG_URLS,
    wearLabel,
    dopplerPhase,
    buildSkinMap,
    buildStickerMap,
    buildKeychainMap,
    buildStickerSlabMap,
    buildGraffitiMap,
    buildAgentMap,
    buildKeyMap,
    lookupSkinName,
    isStickerSlab,
    lookupStickerSlabName,
  };
} else {
  // Browser global
  window.CatalogUtils = {
    CATALOG_URLS,
    wearLabel,
    dopplerPhase,
    buildSkinMap,
    buildStickerMap,
    buildKeychainMap,
    buildStickerSlabMap,
    buildGraffitiMap,
    buildAgentMap,
    buildKeyMap,
    lookupSkinName,
    isStickerSlab,
    lookupStickerSlabName,
  };
}
