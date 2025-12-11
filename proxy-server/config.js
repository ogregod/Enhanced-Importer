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

  spells: (level) =>
    `${DDB_URLS.characterService}/game-data/spells?level=${level}`,

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

  // Spell levels (0 = cantrips, 1-9 = spell levels)
  SPELL_LEVELS: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
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

export default {
  DDB_URLS,
  CACHE_TTL,
  CONSTANTS,
  CLASS_MAP,
  SPELL_SCHOOL_MAP
};
