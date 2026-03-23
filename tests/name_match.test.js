'use strict';

/**
 * Name-matching integration tests for cs2-masked-inspect-online.
 *
 * For each (inspect_url, market_hash_name) pair:
 *  1. Decode the URL with @vlydev/cs2-masked-inspect
 *  2. Look up the resulting item in the ByMykel CSGO-API catalog
 *  3. Assert the resolved name matches the expected market_hash_name
 *
 * Note: Sticker Slabs are identified via proto field 12 (paintKit) inside the keychain
 * Sticker sub-message, which maps to the sticker catalog ID.
 *
 * Requires network access (GitHub Actions has it by default).
 */

const { before, test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { InspectLink } = require('@vlydev/cs2-masked-inspect');
const {
  CATALOG_URLS,
  wearLabel,
  buildSkinMap,
  buildStickerMap,
  buildKeychainMap,
  buildGraffitiMap,
  buildAgentMap,
  buildKeyMap,
  buildCollectibleMap,
  lookupSkinName,
  lookupStickerSlabName,
} = require('../catalog');

// ---------------------------------------------------------------------------
// Catalog maps loaded once before all tests
// ---------------------------------------------------------------------------

let skinMap;     // Map<"wi_pi_suffix", baseName>
let stickerMap;  // Map<id, name>
let keychainMap; // Map<id, name>
let graffitiMap; // Map<"def_index_color_index", {name, image}>
let agentMap;    // Map<def_index, {name, image}>
let keyMap;           // Map<def_index, {name, image}>
let collectibleMap;   // Map<def_index, {name, image}>

before(async () => {
  const [skinsData, stickersData, patchesData, keychainsData, graffitiData, agentsData, keysData, collectiblesData] = await Promise.all([
    fetch(CATALOG_URLS.skins).then(r => r.json()),
    fetch(CATALOG_URLS.stickers).then(r => r.json()),
    fetch(CATALOG_URLS.patches).then(r => r.json()),
    fetch(CATALOG_URLS.keychains).then(r => r.json()),
    fetch(CATALOG_URLS.graffiti).then(r => r.json()),
    fetch(CATALOG_URLS.agents).then(r => r.json()),
    fetch(CATALOG_URLS.keys).then(r => r.json()),
    fetch(CATALOG_URLS.collectibles).then(r => r.json()),
  ]);
  skinMap        = buildSkinMap(skinsData);
  stickerMap     = buildStickerMap(stickersData, patchesData);
  keychainMap    = buildKeychainMap(keychainsData);
  graffitiMap    = buildGraffitiMap(graffitiData);
  agentMap       = buildAgentMap(agentsData);
  keyMap         = buildKeyMap(keysData);
  collectibleMap = buildCollectibleMap(collectiblesData);
});

// ---------------------------------------------------------------------------
// Decode cache
// ---------------------------------------------------------------------------

const _decodeCache = new Map();
function decoded(url) {
  if (!_decodeCache.has(url)) _decodeCache.set(url, InspectLink.deserialize(url));
  return _decodeCache.get(url);
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Weapon skin test: decoded URL → catalog lookup → compare with expected name.
 */
function weaponTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from catalog matches', () => {
      const item = decoded(url);
      const name = lookupSkinName(skinMap, item);
      assert.equal(name, expectedName);
    });
  });
}

/**
 * Sticker / Patch test: decoded → sticker catalog → compare with expected name.
 */
function stickerTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from sticker catalog matches', () => {
      const item = decoded(url);
      const st = item.stickers?.length === 1 ? item.stickers[0] : null;
      assert.ok(st !== null, 'expected exactly one sticker');
      const name = stickerMap.get(st.stickerId);
      assert.equal(name, expectedName);
    });
  });
}

/**
 * Sticker Slab test: decoded → stickerMap.get(keychains[0].paintKit) → compare with expected name.
 */
function stickerSlabTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from sticker catalog matches via paintKit', () => {
      const item = decoded(url);
      const name = lookupStickerSlabName(stickerMap, item);
      assert.equal(name, expectedName);
    });
  });
}

/**
 * Collectible test: decoded → collectibleMap.get(defIndex) → compare with expected name.
 */
function collectibleTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from collectible catalog matches', () => {
      const item = decoded(url);
      const entry = collectibleMap.get(item.defIndex);
      assert.ok(entry != null, `collectible defIndex ${item.defIndex} not found in catalog`);
      assert.equal(entry.name, expectedName);
    });
  });
}

/**
 * Key test: decoded → keyMap.get(defIndex) → compare with expected name.
 */
function keyTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from key catalog matches', () => {
      const item = decoded(url);
      const entry = keyMap.get(item.defIndex);
      assert.ok(entry != null, `key defIndex ${item.defIndex} not found in catalog`);
      assert.equal(entry.name, expectedName);
    });
  });
}

/**
 * Agent test: decoded → agentMap.get(defIndex) → compare with expected name.
 */
function agentTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from agent catalog matches', () => {
      const item = decoded(url);
      const entry = agentMap.get(item.defIndex);
      assert.ok(entry != null, `agent defIndex ${item.defIndex} not found in catalog`);
      assert.equal(entry.name, expectedName);
    });
  });
}

/**
 * Graffiti test: decoded → graffitiMap.get(`${stickerId}_${tintId ?? 0}`) → compare with expected name.
 */
function graffitiTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from graffiti catalog matches', () => {
      const item = decoded(url);
      const st = item.stickers?.length === 1 ? item.stickers[0] : null;
      assert.ok(st !== null, 'expected exactly one sticker entry');
      const key = `${st.stickerId}_${st.tintId ?? 0}`;
      const entry = graffitiMap.get(key);
      assert.ok(entry != null, `graffiti key "${key}" not found in catalog`);
      assert.equal(entry.name, expectedName);
    });
  });
}

/**
 * Keychain / Charm test: decoded → keychain catalog → compare with expected name.
 */
function keychainTest(expectedName, url) {
  describe(expectedName, () => {
    test('name from keychain catalog matches', () => {
      const item = decoded(url);
      const kc = item.keychains?.length === 1 ? item.keychains[0] : null;
      assert.ok(kc !== null, 'expected exactly one keychain');
      const name = keychainMap.get(kc.stickerId);
      assert.equal(name, expectedName);
    });
  });
}

// ===========================================================================
// ★ Bloodhound Gloves (defIndex 5027)
// ===========================================================================

describe('★ Bloodhound Gloves', () => {
  weaponTest('★ Bloodhound Gloves | Bronzed (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20F1E14F7170744AF0E952D6D169BFD9F7C1F2C938153108F2B161F39972717171FD81F9D607BE76');
  weaponTest('★ Bloodhound Gloves | Bronzed (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FCEC7B22160146FDE45FDBDC64B2D4FACCFFC451041B08FFBC27FE947F7C7C7CF08CF441179E5F');
  weaponTest('★ Bloodhound Gloves | Bronzed (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20F7E7117909734CF6EF54D0D76FB9DFF1C7F4CF3C702218F4B73AF49F74777777FB87FF000E319B');
  weaponTest('★ Bloodhound Gloves | Bronzed (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20E1F1217F6A7D54E0F942C6C179AFC9E7D1E2D915607316E2A1A6891AE291E916B2B89B');
  weaponTest('★ Bloodhound Gloves | Charred (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20EAFA0F6B3E1852EBF249CDCA7CA4C2ECDAE9D259500613E9AA7BEF82696A6A6AE69AE2AF10A3C6');
  weaponTest('★ Bloodhound Gloves | Charred (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FCEC5249776046FDE45FDBDC6AB2D4FACCFFC434264108FFBC77FD947F7C7C7CF08CF8CE65E0F6');
  weaponTest('★ Bloodhound Gloves | Charred (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FBEB1D63136340FAE358DCDB6DB5D3FDCBF8C34F057C0BF8BB08F893787B7B7BF78BF313E44EC3');
  weaponTest('★ Bloodhound Gloves | Charred (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FDED276F2A5E46FCE55EDADD6BB3D5FBCDFEC547565C0BFEBD0EFC957E7D7D7DF18DF558ECF64F');
  weaponTest('★ Bloodhound Gloves | Guerrilla (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20DCCC55757F786DDDC47FFBFC6B92F4DAECDFE453075026DF9C84B45ADDACD46B7B0A25');
  weaponTest('★ Bloodhound Gloves | Guerrilla (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20F7E72B15430C46F6EF54D0D740B9DFF1C7F4CF0A754F04F4B7F99F74777777FB87FFB98F90F7');
  weaponTest('★ Bloodhound Gloves | Guerrilla (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20F9E9477B764F4EF8E15ADED94EB7D1FFC9FAC16A132809FAB96EFD917A797979F589FD6E589782');
  weaponTest('★ Bloodhound Gloves | Guerrilla (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20C7D742037F267EC6DF64E0E77089EFC1F7C4FF66213631C4870BC4AF44474747CBB7C3911C75AA');
});

// ===========================================================================
// Patch (sticker catalog)
// ===========================================================================

describe('Patch', () => {
  stickerTest('Patch | Abandon Hope',
    'steam://run/730//+csgo_econ_action_preview%20CEDECED64FEAEECEE6CDFECAACCBC6CEDE07E8A6CEBED9B4AECB2C');
  stickerTest('Patch | Alyx',
    'steam://run/730//+csgo_econ_action_preview%20EEFEEEF66FCACEEEC6EBDEEA8CEBE6EEFE03CD86EE9EE6E3D9881D');
  stickerTest('Patch | Anchors Aweigh',
    'steam://run/730//+csgo_econ_action_preview%20CEDECED64FEAEECEE6CDFECAACCBC6CEDE04E8A6CEBED9CCAF7F76');
  stickerTest('Patch | Aquatic Offensive',
    'steam://run/730//+csgo_econ_action_preview%20AFBFAFB72E8B8FAF87AA9FABCDAAA7AFBF7C89C7AFDFB827205F48');
  stickerTest('Patch | Astralis (Gold) | Stockholm 2021',
    'steam://run/730//+csgo_econ_action_preview%204656465EC76266466E42764224434E4656AC612E46364EF9CAB405');
  stickerTest('Patch | Astralis | Stockholm 2021',
    'steam://run/730//+csgo_econ_action_preview%20E4F4E4FC65C0C4E4CCE7D4E086E1ECE4F40DC38CE494ECAE0ACB4A');
  stickerTest('Patch | BIG (Gold) | Stockholm 2021',
    'steam://run/730//+csgo_econ_action_preview%20EFFFEFF76ECBCFEFC7EBDFEB8DEAE7EFFF1FC887EF9FE73A5B9A39');
  stickerTest('Patch | BIG | Stockholm 2021',
    'steam://run/730//+csgo_econ_action_preview%20DDCDDDC55CF9FDDDF5DEEDD9BFD8D5DDCD32FAB5DDADD54AEBB682');
  stickerTest('Patch | Bayonet Frog',
    'steam://run/730//+csgo_econ_action_preview%20BCACBCA43D989CBC94B98CB8DEB9B4BCAC709AD4BCCCAB7429E7E6');
  stickerTest('Patch | Black Mesa',
    'steam://run/730//+csgo_econ_action_preview%20ECFCECF46DC8CCECC4E8DCE88EE9E4ECFC19CF84EC9CE4AACE4670');
});

// ===========================================================================
// Sticker (sticker catalog)
// ===========================================================================

describe('Sticker', () => {
  stickerTest('Sticker | sk0R (Glitter) | Antwerp 2022',
    'steam://run/730//+csgo_econ_action_preview%200A1A0A12B3032A0A220E3A0E680F020A1ABB27620A7A027C088379');
  stickerTest('Sticker | sk0R (Glitter) | Paris 2023',
    'steam://run/730//+csgo_econ_action_preview%20BAAABAA203B39ABA92BE8ABED8BFB2BAAA1C82D2BACAB2986CD642');
  stickerTest('Sticker | sk0R (Glitter) | Rio 2022',
    'steam://run/730//+csgo_econ_action_preview%20E3F3E3FB5AEAC3E3CBE7D3E781E6EBE3F308D18BE393EBD4D234F8');
  stickerTest('Sticker | sk0R (Gold) | Antwerp 2022',
    'steam://run/730//+csgo_econ_action_preview%206373637BDA6A43634B65536701666B6373D04E0B63136B33D061C4');
  stickerTest('Sticker | sk0R (Gold) | Budapest 2025',
    'steam://run/730//+csgo_econ_action_preview%206E7E6E76D7674E6E46685E6A0C6B666E7EE73E066E1E665BFA0985');
  stickerTest('Sticker | sk0R (Gold) | Paris 2023',
    'steam://run/730//+csgo_econ_action_preview%207E6E7E66C7775E7E56784E7A1C7B767E6ED646167E0E76E66314CC');
  stickerTest('Sticker | sk0R (Gold) | Rio 2022',
    'steam://run/730//+csgo_econ_action_preview%2050405048E9597050785660543255585040BD62385020585020EB74');
  stickerTest('Sticker | sk0R (Holo) | Budapest 2025',
    'steam://run/730//+csgo_econ_action_preview%20D4C4D4CC6DDDF4D4FCD1E4D0B6D1DCD4C45C84BCD4A4DC5488C954');
  stickerTest('Sticker | Doppler Poison Frog (Foil)',
    'steam://run/730//+csgo_econ_action_preview%20FFEFFFE746F6DFFFD7FACFFB9DFAF7FFEF45D997FF8FE88D6A7CAA');
});

// ===========================================================================
// Charm / Keychain (keychain catalog)
// ===========================================================================

describe('Charm', () => {
  keychainTest('Charm | Big Brain',
    'steam://run/730//+csgo_econ_action_preview%20FEEE6A7D77764CFFE635F4DEFED6FACEFA96FF8EE95CFFF9F6FEEEC3AE22F26C84C0CC');
  keychainTest('Charm | Big Kev',
    'steam://run/730//+csgo_econ_action_preview%20FFEF5F6D740345FEE734F5DFFFD7FCCFFB977C7F7F7FF38FE85DFEF7F7FFEFF7AF5249FA2B9B368D');
  keychainTest('Charm | Biomech',
    'steam://run/730//+csgo_econ_action_preview%20FFEF6227781351FEE734F5DFFFD7FCCFFB9777FD8FE85DFEF7F7FFEFC1AF1D35FCE73EF887');
  keychainTest('Charm | Bomb Tag',
    'steam://run/730//+csgo_econ_action_preview%20FDED0F75110E46FCE536F7DDFDD5F9CDF9957E7D7D7DF18DFD5FFCF5F5FDEDB5AD7F7FFE3EDD1F37');
  keychainTest('Charm | Butane Buddy',
    'steam://run/730//+csgo_econ_action_preview%20FEEE50136D5B44FFE635F4DEFED6F8CEFA96B68EE95CFFF6F6FEEEAFAE1476FFC3A69860');
  keychainTest("Charm | Chicken Lil'",
    'steam://run/730//+csgo_econ_action_preview%20FFEF62304D0449FEE734F5DFFFD7FBCFFB97FE8FE85DFEF7F7FFEFFAAF2F6FFA1A5F3FA1');
  keychainTest('Charm | Dead Weight',
    'steam://run/730//+csgo_econ_action_preview%20FFEF4152411B51FEE734F5DFFFD7FCCFFB978C8FE85DFEF7F7FFEFD6AF156DFB6E8D3FE1');
  keychainTest('Charm | Diamond Dog',
    'steam://run/730//+csgo_econ_action_preview%20FFEF2019453344FEE734F5DFFFD7FACFFB977C7F7F7FF38FE85DFEF7F7FFEFF4AF2702FAFDEA17DD');
  keychainTest('Charm | Die-cast AK',
    'steam://run/730//+csgo_econ_action_preview%20FFEF6343494B44FEE734F5DFFFD7FBCFFB97CA8FE85DFEF7F7FFEFEDAF211AFB3F819387');
  keychainTest('Charm | Diner Dog',
    'steam://run/730//+csgo_econ_action_preview%20FAEA4502227C41FBE231F0DAFAD2FFCAFE92797A7A7AF68AFA58FBF2F2FAEAF7AA4650F943A72452');
  keychainTest('Charm | Disco MAC',
    'steam://run/730//+csgo_econ_action_preview%20FEEE4C7A740844FFE635F4DEFED6FACEFA967D7E7E7EF28EE95CFFF6F6FEEEE7AE0452FF9064A0FA');
  keychainTest('Charm | Dr. Brian',
    'steam://run/730//+csgo_econ_action_preview%20FFEF7760520046FEE734F5DFFFD7FBCFFB97E68FE85DFEF7F7FFEFADAF286FFE5A62D843');
});

// ===========================================================================
// M249 (defIndex 14)
// ===========================================================================

describe('M249', () => {
  weaponTest('M249 | Aztec (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FAEA4C181C3C4DFBE2F4DA7CFDD2FECAFEC27D4A6303F9BA69FB92797A7A7AF68AF2CBF9853A');
  weaponTest('M249 | Aztec (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF5F19062B49FEE7F1DF79F8D7FBCFFBC76F100114FCBF4AF9977C7F7F7FF38FF762CB77DF');
  weaponTest('M249 | Aztec (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF123D380548FEE7F1DF79F8D7FBCFFBC7254F470AFCBF00FA977C7F7F7FF38FFB820A385F');
  weaponTest('M249 | Aztec (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20F9E95C11097543F8E1F7D97FFED1FDC9FDC130734209FAB9C6917A797979F589F1BB959C74');
  weaponTest('M249 | Aztec (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF2D7C370195E7F1DF79F8D7FBCFFBC705277508FCBF7CFE97E78FF71C3B8649');
  weaponTest('M249 | Blizzard Marbleized (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20CDDD66012C1977CCD5C3ED86E5CFFDC9F5792A7534CE8D52C8A54E4D4D4DC1BDCDDB82C8B9');
  weaponTest('M249 | Blizzard Marbleized (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20F8E83E687F1E42F9E0F6D8B3D0FAC8FCC0264C4514FBB831F99AF7F0F9E870C2C568619D45BDA84915449AF7F0FBE870C2C534923BC6BD187AE6469AF7F0FBE870C2C5D3A150C6BD1823FF469AF7F0FBE870C2C5F8E7B843BDD88283C49AF7F0F8E870C2C504476346BD08CC55C4907BFA88FCED3A19E8');
  weaponTest('M249 | Blizzard Marbleized (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20BDAD5470307210BCA5B39DF695BF8DB9851E77564FBEFD1ABBD536BFCDBD8BB92549');
  weaponTest('M249 | Blizzard Marbleized (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%207B6BC6E2C99BC17A63755B3053794B7F43FB90D38B783BBF79137A0B7BB4E85527');
  weaponTest('M249 | Blizzard Marbleized (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20E1F10A297F095AE0F9EFC1AAC9E3D1E5D953766A17E2A111E38962616161ED91E1ABC42BAA');
});

// ===========================================================================
// AK-47 (defIndex 7)
// ===========================================================================

describe('AK-47', () => {
  weaponTest('AK-47 | Aphrodite (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF6505056144FEE7F8DF0AF5D7F9CFFBC72B147B07FCBF36F8977C7F7F7FF38FE8A4E1089F');
  weaponTest('AK-47 | Aphrodite (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20F8E8274E436B42F9E0FFD80DF2D0FEC8FCC032144A1FFBB866F99036F988EFD520D55D');
  weaponTest('AK-47 | Aphrodite (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE49231A7444FFE6F9DE0BF4D6F8CEFAC620064C0BFDBE66FD967CFC8EE992E8F506');
  weaponTest('AK-47 | Aphrodite (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FDED3D312B0E47FCE5FADD08F7D5FBCDF9C51E170310FEBD22F9957E7D7D7DF18DEAD801493D');
  weaponTest('AK-47 | Aphrodite (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF531A393944FEE7F8DF0AF5D7F9CFFBC702562E09FCBF00FD9DF0F7FCEF46B3C23F6559C4BABFDB27C4977C7F7F7FF38FE8068F5D0E');
  weaponTest('AK-47 | Aquamarine Revenge (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF725F241745FEE7F8DF25FCD7F9CFFBC736065A07FCBF53FB9DEBF7FDEF1BCCD2FFFFEF3EC21BD56943BA7DC6A5C19DEBF7FFEF1BCCD2FFFFDDBCC21E0FC841BA3552CCC19DE6F7FFEF1BCCE25B8FC2C0D2FFFF3FBFC24F15DE41BA0BE9DBC19DE6F7FCEF1BCCE2CCCCCCC0D2FFFFCEBCC2AF0BCFC1BACBE7FEC19DE6F7FCEF1BCCE2D6A3B0C0D2FFFF0F3EC27160BDC1BACBE715C2977C7F7F7FF38FFB1BDDA49A');
  weaponTest('AK-47 | Aquamarine Revenge (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF03373B0949FEE7F8DF25FCD7F9CFFBC75C094313FCBF2DFD977C7F7F7FF38FFB494F34FF');
  weaponTest('AK-47 | Aquamarine Revenge (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF6A23074D49FEE7F8DF25FCD7F9CFFBC72814340BFCBF25F8977C7F7F7FF38FFBEBE6D31F');
  weaponTest('AK-47 | Aquamarine Revenge (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF4A37370945FEE7F8DF25FCD7F9CFFBC7273C0510FCBFD89DFAF7FFEF7BDA9DFAF7FEEF7BDA9DFAF7FDEF7BDA9DFAF7FCEF7BDA977C7F7F7FF38FFBAFB624C3');
  weaponTest('AK-47 | Aquamarine Revenge (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF71011D5444FEE7F8DF25FCD7F9CFFBC74A442609FCBF77FE977C7F7F7FF38FF7BC2AF89F');
});

// ===========================================================================
// ★ Bayonet (defIndex 500)
// ===========================================================================

describe('★ Bayonet', () => {
  weaponTest('★ Bayonet | Autotronic (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FAEA52740E3F40FBE20EF9DA47FED2FCCAF9C2197A3A02F9BA73FE927AF88AFE20017CC6');
  weaponTest('★ Bayonet | Autotronic (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20ACBC2B713B7316ADB458AF8C11A884AA9CAF943E66514BAFEC18ADC42F2C2C2CA0DCA49199870A');
  weaponTest('★ Bayonet | Autotronic (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20F1E1021A7F0846F0E905F2D14CF5D9F7C1F2C913051804F2B1A899FE81F55419B9C5');
  weaponTest('★ Bayonet | Autotronic (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20DECE60204A7962DFC62ADDFE63DAF6D8EEDDE61E581030DD9E3FDBB65C5E5E5ED2AEDA765F48ED');
  weaponTest('★ Bayonet | Autotronic (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20ABBB6948385811AAB35FA88B16AF83AD9BA8931754125DA8EB15ADC3282B2B2BA7DBAF056B4C1A');
  weaponTest('★ Bayonet | Black Laminate (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20E9F967421B6A52E8F11DEAC95AEDC1EFD9EAD151357A13EAA9F0816A696969E599E15044EAC9');
  weaponTest('★ Bayonet | Black Laminate (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20CFDF5348555374CED73BCCEF7CCBE7C9FFCCF74D495E25CC8F0ECEA74C4F4F4FC3BFC78B3F99C6');
  weaponTest('★ Bayonet | Black Laminate (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20F8E84955755F43F9E00CFBD84BFCD0FEC8FBC01E2D340DFBB805F9907B787878F488FC03325642');
  weaponTest('★ Bayonet | Black Laminate (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20F3E3345C484558F2EB07F0D340F7DBF5C3F0CB1D6E4403F0B34DF69BF283FB61FD04F4');
  weaponTest('★ Bayonet | Black Laminate (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20F1E13D7E785A4BF0E905F2D142F5D9F7C1F2C95B523B07F2B105F29972717171FD81F5D3A10FB3');
});

// ===========================================================================
// MAG-7 (defIndex 27)
// ===========================================================================

describe('MAG-7', () => {
  weaponTest('MAG-7 | BI83 Spectrum (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20F7E7327F07414CF6EFECD736FFDFF3C7F3CF7F7E6900F4B750F09F74777777FB87FF01D3FDB7');
  weaponTest('MAG-7 | BI83 Spectrum (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FCEC0264174746FDE4E7DC3DF4D4F8CCF8C4084D5610FFBC76FA947F7C7C7CF08CF4A2F61C3C');
  weaponTest('MAG-7 | BI83 Spectrum (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20F8E8513F373A43F9E0E3D839F0D0FCC8FCC02C59470BFBB85CFE907B787878F488F02803F938');
  weaponTest('MAG-7 | BI83 Spectrum (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FCEC542D7C7347FDE4E7DC3DF4D4F8CCF8C4657E1613FFBC67F9947F7C7C7CF08CF8720F937C');
  weaponTest('MAG-7 | BI83 Spectrum (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF343B4F1945FEE7E4DF3EF7D7FBCFFBC71D4D2709FCBF6EFC9DFAF7FFEF53D1977C7F7F7FF38FFB1D9A2F2A');
  weaponTest('MAG-7 | Bulldozer (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE2F70327042FFE6E5DED9D6FACEFAC6743B5309FDBE47FA9CFBF6FEEE25D89CFBF6FFEE25D8967D7E7E7EF28EFE8AA16B71');
  weaponTest('MAG-7 | Bulldozer (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20D2C21B2631076BD3CAC9F2F5FAD6E2D6EA2B66653ED19239D6BA05D3A2D6192FDE6E');
  weaponTest('MAG-7 | Bulldozer (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FBEB2D4625674AFAE3E0DBDCD3FFCBFFC33D494709F8BBBE99FEF3FBEB76DE99FEF3FAEB75DE99FEF3F9EB75DE99FEF3F8EB76DE93C48BFBE91FD22D');
  weaponTest('MAG-7 | Bulldozer (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FBEB5E4C35534EFAE3E0DBDCD3FFCBFFC32F13710BF8BB26FD936AF98BFB975EAD2F');
  weaponTest('MAG-7 | Bulldozer (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FDED3D6C4A7B46FCE5E6DDDAD5F9CDF9C5650B6B0BFEBD2CFA957E7D7D7DF18DFD686E169A');
});

// ===========================================================================
// CZ75-Auto (defIndex 63)
// ===========================================================================

describe('CZ75-Auto', () => {
  weaponTest('CZ75-Auto | Army Sheen (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20F2E26226474A41F3EACDD258F0DAF3C2F6CA2A5C011AF1B241F09A71727272FE82E518A06652');
  weaponTest('CZ75-Auto | Army Sheen (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20F6E63D7E5B474CF7EEC9D65CF4DEF7C6F2CE41243404F5B64DF49E75767676FA86EEB85E7A56');
  weaponTest('CZ75-Auto | Army Sheen (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20ADBD4E69341116ACB5928D07AF85AC9DA9953925375DAEED3DACC52E2D2D2DA1DDBA5795BC0D');
  weaponTest('CZ75-Auto | Chalice (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20C2D27518522C74C3DAFDE207C0EAC6F2C6FA7C485A24C18202C0AA41424242CEB2C6FD6488A2');
  weaponTest('CZ75-Auto | Chalice (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%202B3BFEB8A9A9902A33140BEE29032F1B2F13F3F3AAC6286BC52F43A8ABABAB275B33FC47EA2B');
  weaponTest('CZ75-Auto | Circaetus (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE2C692D3944FFE6C1DE72F6D6FDCEFAC610182509FDBE66FA96FF8EF6B70CF762');
  weaponTest('CZ75-Auto | Circaetus (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20ECFC0F07482A57EDF4D3CC60E4C4EFDCE8D41B324305EFAC27EE846F6C6C6CE09CE4D9779CAC');
  weaponTest('CZ75-Auto | Circaetus (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF0225143744FEE7C0DF73F7D7FCCFFBC73F59130EFCBF75FD977C7F7F7FF38FF7ABF9117F');
  weaponTest('CZ75-Auto | Circaetus (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20F9E967755C5D45F8E1C6D975F1D1FAC9FDC132486316FAB97FFB911BFB89F1FBF7314E');
  weaponTest('CZ75-Auto | Circaetus (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF7B1F7F7682E7C0DF73F7D7FCCFFBC730245A09FCBF23FA979A8FF7A2C80178');
});

// ===========================================================================
// MAC-10 (defIndex 17)
// ===========================================================================

describe('MAC-10', () => {
  weaponTest('MAC-10 | Acid Hex (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF2D0E1D1947FEE7EEDF70F5D7FDCFFBC72A2E2F08FCBFFD97E88FE7C40C9340');
  weaponTest('MAC-10 | Acid Hex (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF797A490F44FEE7EEDF70F5D7FDCFFBC7216F7C15FCBF57FD9705FE8FE7E77CB7FC');
  weaponTest('MAC-10 | Acid Hex (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF5E40283744FEE7EEDF70F5D7FDCFFBC73609490CFCBF43F897F58FE7096C7CE7');
  weaponTest('MAC-10 | Acid Hex (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE1A2B0D4C45FFE6EFDE71F4D6FCCEFAC66C032512FDBE46F8967D7E7E7EF28EE649793EBE');
  weaponTest('MAC-10 | Acid Hex (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20EFFF086F206154EEF7FECF60E5C7EDDFEBD74D0B4619ECAF6BED876C6F6F6FE39FF759F692EF');
  weaponTest('MAC-10 | Allure (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE12547E0847FFE6EFDE3BF9D6FACEFAC64B727906FDBE34FF967D7E7E7EF28EF64BDA525E');
  weaponTest('MAC-10 | Allure (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE775A383D4EFFE6EFDE3BF9D6FACEFAC6783A1714FDBEB696FA8EF6B4E0DC5D');
  weaponTest('MAC-10 | Allure (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF7004711B4DFEE7EEDF3AF8D7FBCFFBC73177600CFCBF18F897998FF78DB88B97');
  weaponTest('MAC-10 | Allure (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF0D651B4F49FEE7EEDF3AF8D7FBCFFBC77173610FFCBF45F997EB8FF7B92AB9CB');
  weaponTest('MAC-10 | Allure (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FDED764E435E46FCE5ECDD38FAD5F9CDF9C558035C0BFEBD3EFC957E7D7D7DF18DF585287C3D');
});

// ===========================================================================
// AWP (defIndex 9)
// ===========================================================================

describe('AWP', () => {
  weaponTest('AWP | Acheron (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF5722161E45FEE7F6DF6BF9D7FCCFFBC745260B08FCBF6DF99DE6F7FCEF53CBE2FFFF7FC0D2FFFFBFBFC2FF009543BAFFC181C5977DFD8FE75DFEE8F7FFEFC1C23C52F5BFBAE687BBC0B2ED4ACABEAF6B02FA0F88B7BD');
  weaponTest('AWP | Acheron (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FAEA7E3F633141FBE2F3DA6EFCD2F9CAFEC20B2F5F1BF9BAE998FFF2F9EA7AD492797A7A7AF68AFEC6E2E116');
  weaponTest('AWP | Acheron (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE7232704E4AFFE6F7DE6AF8D6FDCEFAC62312750AFDBE79FC9CFBF6FDEE10D89CF1F6FEEE0ACDC37E111345BBFE6A16479CF1F6FAEE0ACDC3944FAD40BBFE849FC59CF1F6FAEE0ACDC34EDBCC43BBDE5660C29CF1F6FCEE0ACDC3DFB85BC3BBA26B6F4396B48EFA7108E109');
  weaponTest('AWP | Acheron (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF4F34682B44FEE7F6DF6BF9D7FCCFFBC7231F0111FCBF0FFB97EE8FE75DFEE9F7FFEFDAC21B418BBEBABA4661C0B2C4BECBBE9F08B5FD6D6769');
  weaponTest('AWP | Acheron (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF0063463245FEE7F6DF6BF9D7FCCFFBC730406309FCBF3AFA977C7F7F7FF38FE7D828C89F');
  weaponTest('AWP | Arsenic Spill (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF5E54556E45FEE7F6DF53F5D7FCCFFBC749143D08FCBF8C97757F7F7FF38FE7612FF441');
  weaponTest('AWP | Arsenic Spill (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF206B7A6044FEE7F6DF53F5D7FCCFFBC702167113FCBF6DFD977C7F7F7FF38FE7C63D433F');
  weaponTest('AWP | Arsenic Spill (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF5E661D6F44FEE7F6DF53F5D7FCCFFBC70E1F000BFCBF76F9977C7F7F7FF38FE796622A1F');
  weaponTest('AWP | Arsenic Spill (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF530B127944FEE7F6DF53F5D7FCCFFBC712403D0FFCBF2BFE977C7F7F7FF38FFB51D9A8FF');
  weaponTest('AWP | Arsenic Spill (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF763A2E6944FEE7F6DF53F5D7FCCFFBC7060B6F08FCBF919DEBF7FCEF0ACCE2FFFF7FC0C2FFB1B144BAFFE7CBC59DF5F7FDEF0ACCE21E85ABC09DF5F7FEEF0ACCE23233B3C09DEBF7FDEF0ACCE2FFFF7FC0C26FBAF1C2BAFFBFF3479DEBF7FDEF0ACCE25B8FC2C0C275C3EA42BAFF65F845977C7F7F7FF38FE72A760747');
  weaponTest('AWP | Asiimov (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE1B47225D45FFE6F7DE69FCD6F8CEFAC6295B0106FDBEAF9CFBF6FEEE6BDB9CFBF6FFEE2FCD9CFBF6FCEE0CDA9CFBF6FDEE6BDB9CF1F6FDEE53DBC3AADEB9C0BB7E2394C5967D7E7E7EF28EFA87108FF2');
  weaponTest('AWP | Asiimov (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FEEE65354E3A6AFFE6F7DE69FCD6F8CEFAC65D16570AFDBEC79CFBF6FEEE0EFC9CFBF6FFEE0EFC9CFBF6FCEE0EFC9CFBF6FDEE0EFC96FF8EFA5CFFE9F6FEEEF2C3120CF9BFBB0A7151C1B33CB6CDBFAE4678FCFC5128D5');
  weaponTest('AWP | Asiimov (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF6E567D4944FEE7F6DF68FDD7F9CFFBC7040B6908FCBF11FB9DF0F7FBEF24DEC28779CBC2BA0FD893429DFAF7FDEF40E09DFAF7FBEF35E29DF0F7FFEF40E0C263DC6841BACB5E5B42977C7F7F7FF38FF79EA8160F');
});

// ===========================================================================
// Glock-18 | Gamma Doppler (defIndex 4)
// Each item has a different phase encoded in paintIndex
// ===========================================================================

describe('Glock-18 | Gamma Doppler', () => {
  weaponTest('Glock-18 | Gamma Doppler (Phase 4) (Battle-Scarred)',
    'steam://run/730//+csgo_econ_action_preview%20FDED2B53064248FCE5F9DD1EF5D5FBCDF9C5193D1D0AFEBD70FA957E7D7D7DF18DEA382DF5DD');
  weaponTest('Glock-18 | Gamma Doppler (Emerald) (Factory New)',
    'steam://run/730//+csgo_econ_action_preview%20FDED226D0A2047FCE5F9DD22F5D5FBCDF9C536557A11FEBD4BF995B68DF9CF0A1531');
  weaponTest('Glock-18 | Gamma Doppler (Phase 3) (Field-Tested)',
    'steam://run/730//+csgo_econ_action_preview%20FFEF435F467844FEE7FBDF1DF7D7F9CFFBC7264A590BFCBF4BFE977C7F7F7FF38FE88ED2AB9F');
  weaponTest('Glock-18 | Gamma Doppler (Phase 2) (Minimal Wear)',
    'steam://run/730//+csgo_econ_action_preview%20FBEB1A414C2843FAE3FFDB1AF3D3FDCBFFC3371F2D14F8BB10FF99FEF3FBEB10DD99FEF3FAEB10DD99FEF3F9EB10DD99F4F3F8EB32C8C6FB136F40BE1BC370C793787B7B7BF78BEC06102CAD');
  weaponTest('Glock-18 | Gamma Doppler (Phase 4) (Well-Worn)',
    'steam://run/730//+csgo_econ_action_preview%20FAEA364B474340FBE2FEDA19F2D2FCCAFEC21426340CF9BA09FF98F0F2F9EA5ED4E7FAFA7AC592797A7A7AF68AEDA15DDA7E');
});

// ===========================================================================
// Sticker Slab (defIndex 1355, quality 8)
// Identified via keychains[0].paintKit → sticker catalog ID
// ===========================================================================

describe('Sticker Slab', () => {
  stickerSlabTest('Sticker | The Mongolz (Gold) | Budapest 2025',
    'steam://run/730//+csgo_econ_action_preview%20C8D8C8D003C2E8C8E0CEF8C0A0C8B8C86AC9CFC0C8D8EDA8688287E4A630');
  stickerSlabTest('Sticker | FaZe Clan (Holo) | Budapest 2025',
    'steam://run/730//+csgo_econ_action_preview%20F9E9F9E132F3D9F9D1FCC9F191F989F95BF8FEF1F9E9DC992EB38B9209A9');
  stickerSlabTest('Sticker | mousesports | Cluj-Napoca 2015',
    'steam://run/730//+csgo_econ_action_preview%20819181994A8BA181A982B189E981F181238086898191A4E1208698F309C9');
  stickerSlabTest('Sticker | StarLadder (Holo) | Budapest 2025',
    'steam://run/730//+csgo_econ_action_preview%20BBABBBA370B19BBB93BE8BB3D3BBCBBB19BABCB3BBAB9EDB28F0677E5CA3');
  stickerSlabTest('Sticker | donk (Foil) | Austin 2025',
    'steam://run/730//+csgo_econ_action_preview%2008180810C3022808200C380060087808AA090F0008182D68C84C11288898');
  stickerSlabTest('Sticker | Supreme Master First Class (Holo)',
    'steam://run/730//+csgo_econ_action_preview%205A4A5A4291507A5A725E6A52325A2A5AF85B5D525A4A7F3AA540C22C8A12');
});

// ===========================================================================
// Graffiti (stickers[0].stickerId = def_index, stickers[0].tintId = color_index)
// ===========================================================================

describe('Graffiti', () => {
  graffitiTest('Sealed Graffiti | Mr. Teeth (War Pig Pink)',
    'steam://run/730//+csgo_econ_action_preview%20F1E1F1E934FBD1F1D9F0C1F593F6F9F1E15AFCC1E399F181E93306C5A1');
  graffitiTest('Sealed Graffiti | Tilt (Cash Green)',
    'steam://run/730//+csgo_econ_action_preview%203727372FF33D17371F36073355303F37279F3A073D5F37472F54EC7E05');
  graffitiTest('Sealed Graffiti | Heart (Monster Purple)',
    'steam://run/730//+csgo_econ_action_preview%209B8B9B835E91BB9BB39AAB9FF99C939B8B2396AB94F39BEB83E69CD41F');
  graffitiTest('Sealed Graffiti | Double (War Pig Pink)',
    'steam://run/730//+csgo_econ_action_preview%201707170FD31D37173F16271375101F1707B11A27057F17670F8AB8EED0');
  graffitiTest('Sealed Graffiti | 200 IQ (Brick Red)',
    'steam://run/730//+csgo_econ_action_preview%20D4C4D4CC11DEF4D4FCD5E4D0B6D3DCD4C444CBE4D5BCD4A4C38FC9D232');
  graffitiTest('Sealed Graffiti | Eco (Tracer Yellow)',
    'steam://run/730//+csgo_econ_action_preview%20D5C5D5CD11DFF5D5FDD4E5D1B7D2DDD5C572D8E5D3BDD5A5CDB2E310D1');
  graffitiTest('Sealed Graffiti | Take Flight (Desert Amber)',
    'steam://run/730//+csgo_econ_action_preview%201B0B1B03DF113B1B331A2B1F791C131B0BD3162B1E731B6B038591C5A3');
  graffitiTest('Sealed Graffiti | Ninja (Frog Green)',
    'steam://run/730//+csgo_econ_action_preview%20E5F5E5FD21EFC5E5CDE4D5E187E2EDE5F549E8D5EC8DE595FD2A8CBC2C');
  graffitiTest('Sealed Graffiti | Eco (Princess Pink)',
    'steam://run/730//+csgo_econ_action_preview%206D7D6D75A9674D6D456C5D690F6A656D7DCA605D7C056D1D759887272D');
  graffitiTest('Sealed Graffiti | Death Sentence (Bazooka Pink)',
    'steam://run/730//+csgo_econ_action_preview%201505150DD01F35153D14251177121D1505B71825057D15650D16B253F3');
});

// ===========================================================================
// Agent (defIndex maps directly to agents.json)
// ===========================================================================

describe('Agent', () => {
  agentTest("'Two Times' McCoy | TACP Cavalry",
    'steam://run/730//+csgo_econ_action_preview%203424A3B3B0918D352CFC1014341C3104305CB7B4B4B438442358B67732');
  agentTest('Seal Team 6 Soldier | NSWC SEAL',
    'steam://run/730//+csgo_econ_action_preview%20BBAB1F102A6B00BAA322919BBB93B88BBFD3383B3B3BB7CBACFF8DFCD7');
  agentTest('The Elite Mr. Muhlik | Elite Crew',
    'steam://run/730//+csgo_econ_action_preview%209E8E422A354C259F866AB9BE9EB698AE9AFC94969E8E4DBDBB098F17A1FC9B969F8E4DBDFC94969C8E4DBDBB5B7F1BA1F61D1E1E1E92EE8902636998');
  agentTest('Elite Trapper Solman | Guerrilla Warfare',
    'steam://run/730//+csgo_econ_action_preview%206E7EEBD3C587D46F76CB4B4E6E466B5E6A06EDEEEEEE621E79D1228976');
  agentTest('Osiris | Elite Crew',
    'steam://run/730//+csgo_econ_action_preview%206E7E8193B1AA09769C494E6E466A5E6A06EDEEEEEE621E79D3A851C8');
  agentTest("'Two Times' McCoy | TACP Cavalry",
    'steam://run/730//+csgo_econ_action_preview%209D8D5730541C1F9C8555B9BD9DB598AD99F593ED8AFA1EEB7B');
  agentTest('Operator | FBI SWAT',
    'steam://run/730//+csgo_econ_action_preview%205E4EA8FACBACEC5F46E7777E5E765D6E5A3C54565C4E8C7D7B9B0BD861364A2E4953ED5DA6');
  agentTest('Seal Team 6 Soldier | NSWC SEAL',
    'steam://run/730//+csgo_econ_action_preview%20A9B9057622041AA8B1308389A981AA99ADC1F0D9BE9D58D329');
});

// ===========================================================================
// Key (defIndex maps directly to keys.json)
// ===========================================================================

describe('Key', () => {
  keyTest('Kilowatt Case Key',
    'steam://run/730//+csgo_econ_action_preview%20D1C1D1C923DBF1D1F9D0E1D5B9D1A1D3534B86DF');
  keyTest('Huntsman Case Key',
    'steam://run/730//+csgo_econ_action_preview%200018990A28013004700285AE0A38');
  keyTest('Glove Case Key',
    'steam://run/730//+csgo_econ_action_preview%20A8B8A8B064A288A880A998ACC0A8D8AA21416D74');
  keyTest('Revolution Case Key',
    'steam://run/730//+csgo_econ_action_preview%20D5C5D5CD24DFF5D5FDD4E5D1BDD5A5D739E6EDA5');
  keyTest('Spectrum Case Key',
    'steam://run/730//+csgo_econ_action_preview%20CEDECED61AC4EECEE6CFFECAA6CEBECC50A90D60');
});

// ===========================================================================
// Collectible (defIndex maps directly to collectibles.json)
// ===========================================================================

describe('Collectible', () => {
  collectibleTest('Shanghai 2024 Viewer Pass',
    'steam://run/730//+csgo_econ_action_preview%208999899154AFA989A188B98DE189F98B88188547');
  collectibleTest('Austin 2025 Viewer Pass + 3 Souvenir Tokens',
    'steam://run/730//+csgo_econ_action_preview%200414041CFF2324042C0534006C047406518AAE74');
  collectibleTest('Austin 2025 Viewer Pass + 3 Souvenir Tokens',
    'steam://run/730//+csgo_econ_action_preview%20ABBBABB3508C8BAB83AA9BAFC3ABDBA9E29BA505');
  collectibleTest('Operation Riptide Premium Pass',
    'steam://run/730//+csgo_econ_action_preview%20A6B6A6BE308386A68EA796A2CEA6D6A4EB8B6208');
  collectibleTest('Operation Broken Fang Premium Pass',
    'steam://run/730//+csgo_econ_action_preview%20ACBCACB477888CAC84AD9CA8C4ACDCAEA21F7BC2');
});
