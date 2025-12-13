/**
 * D&D Beyond API Configuration
 *
 * Centralizes all API URLs, constants, and configuration for the proxy server.
 */

// D&D Beyond API Base URLs
export const DDB_URLS = {
  authService: 'https://auth-service.dndbeyond.com/v1',
  characterService: 'https://character-service.dndbeyond.com/character/v5',
  monsterService: 'https://monster-service.dndbeyond.com/v1/Monster',

  // Game data endpoints
  items: (sharingSetting = 2) =>
    `${DDB_URLS.characterService}/game-data/items?sharingSetting=${sharingSetting}`,

  // Spells by class (correct D&D Beyond API format)
  spells: (classId, classLevel = 20, campaignId = null) => {
    const campaign = campaignId ? `&campaignId=${campaignId}` : '';
    return `${DDB_URLS.characterService}/game-data/spells?classId=${classId}&classLevel=${classLevel}&sharingSetting=2${campaign}`;
  },

  character: (characterId) =>
    `${DDB_URLS.characterService}/character/${characterId}`,

  // Monster endpoints (for future use)
  monsters: (skip, take, search = '', showHomebrew = false, sources = []) => {
    const homebrewParam = showHomebrew ? '&showHomebrew=t' : '&showHomebrew=f';
    const sourceParams = sources.map(s => `&sources=${s}`).join('');
    return `${DDB_URLS.monsterService}?search=${search}&skip=${skip}&take=${take}${homebrewParam}${sourceParams}`;
  },

  monstersByIds: (ids = []) => {
    const idParams = ids.map((id, idx) => `${idx === 0 ? '?' : '&'}ids=${id}`).join('');
    return `${DDB_URLS.monsterService}${idParams}`;
  }
};

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  AUTH: 5 * 60 * 1000,        // 5 minutes - bearer tokens expire quickly
  CONFIG: 60 * 60 * 1000,     // 1 hour - configuration data
  DATA: 60 * 60 * 1000,       // 1 hour - items, spells, monsters
  SPELLS: 60 * 60 * 1000,     // 1 hour - spell data
  ITEMS: 60 * 60 * 1000       // 1 hour - item data
};

// D&D Beyond Content Constants
export const CONSTANTS = {
  // Unearthed Arcana source ID - filter this out as it's playtest content
  EXCLUDED_SOURCE_ID: 39,

  // API pagination limits
  MONSTER_PAGE_SIZE: 100,     // D&D Beyond API limit for monsters

  // Request timeout (30 seconds)
  REQUEST_TIMEOUT: 30000,

  // User agent for API requests
  USER_AGENT: 'Foundry-VTT-DDB-Importer/1.1.0',

  // Max class level for fetching all available spells
  MAX_CLASS_LEVEL: 20,

  // Spellcasting class IDs (from ddb-proxy)
  SPELLCASTING_CLASSES: [
    { id: 1, name: 'Bard' },
    { id: 2, name: 'Cleric' },
    { id: 3, name: 'Druid' },
    { id: 4, name: 'Paladin' },
    { id: 5, name: 'Ranger' },
    { id: 6, name: 'Sorcerer' },
    { id: 7, name: 'Warlock' },
    { id: 8, name: 'Wizard' },
    { id: 9, name: 'Barbarian' },  // Path of Wild Magic, etc.
    { id: 10, name: 'Fighter' },    // Eldritch Knight
    { id: 11, name: 'Monk' },       // Way of the Four Elements
    { id: 12, name: 'Rogue' },      // Arcane Trickster
    { id: 252717, name: 'Artificer' },
    { id: 357975, name: 'Blood Hunter' }
  ]
};

// D&D Beyond Class IDs to names mapping
export const CLASS_MAP = {
  1: 'Barbarian',
  2: 'Bard',
  3: 'Cleric',
  4: 'Druid',
  5: 'Fighter',
  6: 'Monk',
  7: 'Paladin',
  8: 'Ranger',
  9: 'Rogue',
  10: 'Sorcerer',
  11: 'Warlock',
  12: 'Wizard',
  13: 'Artificer',
  14: 'Blood Hunter'
};

// Spell school IDs to names mapping
export const SPELL_SCHOOL_MAP = {
  1: 'Abjuration',
  2: 'Conjuration',
  3: 'Divination',
  4: 'Enchantment',
  5: 'Evocation',
  6: 'Illusion',
  7: 'Necromancy',
  8: 'Transmutation'
};

// D&D Beyond Source Book IDs to names mapping
export const SOURCE_BOOK_MAP = {
  1: 'Player\'s Handbook',
  2: 'Monster Manual',
  3: 'Dungeon Master\'s Guide',
  4: 'Sword Coast Adventurer\'s Guide',
  6: 'Volo\'s Guide to Monsters',
  9: 'Xanathar\'s Guide to Everything',
  10: 'Mordenkainen\'s Tome of Foes',
  13: 'Adventure Module', // TODO: Verify exact book name
  17: 'Wayfinder\'s Guide to Eberron',
  27: 'Guildmasters\' Guide to Ravnica',
  28: 'Acquisitions Incorporated',
  37: 'Eberron: Rising from the Last War',
  39: 'Unearthed Arcana',
  40: 'Explorer\'s Guide to Wildemount',
  51: 'Tasha\'s Cauldron of Everything',
  52: 'Van Richten\'s Guide to Ravenloft',
  55: 'Fizban\'s Treasury of Dragons',
  56: 'Strixhaven: A Curriculum of Chaos',
  57: 'Mordenkainen Presents: Monsters of the Multiverse',
  67: 'Spelljammer: Adventures in Space',
  73: 'Bigby Presents: Glory of the Giants',
  76: 'The Book of Many Things',
  77: 'Planescape: Adventures in the Multiverse',
  79: 'Phandelver and Below: The Shattered Obelisk',
  87: 'Vecna: Eve of Ruin',
  162: '2024 Player\'s Handbook', // 2024 Core Rulebook Update
  // Add more as needed
};

export default {
  DDB_URLS,
  CACHE_TTL,
  CONSTANTS,
  CLASS_MAP,
  SPELL_SCHOOL_MAP,
  SOURCE_BOOK_MAP
};
