/**
 * Spells Module
 *
 * Handles fetching and processing spell data from D&D Beyond:
 * - Fetches spells across all levels (0-9) in parallel
 * - Extracts class availability for each spell
 * - Extracts ritual, concentration, and component data
 * - Filters Unearthed Arcana content
 * - Deduplicates spells by ID
 */

import fetch from 'node-fetch';
import { DDB_URLS, CONSTANTS, CLASS_MAP, SPELL_SCHOOL_MAP } from './config.js';
import { getAuthHeaders } from './auth.js';

/**
 * Filter out Unearthed Arcana content (sourceId 39)
 * @param {Array} spells - Array of spell objects
 * @returns {Array} - Filtered spell array
 */
function filterUnearthedArcana(spells) {
  return spells.filter(spell => {
    // Check if spell has sources
    if (!spell.definition?.sources && !spell.sources) {
      return true; // Include if no source info
    }

    const sources = spell.definition?.sources || spell.sources || [];

    // Filter out if any source is UA (sourceId 39)
    return !sources.some(source =>
      source.sourceId === CONSTANTS.EXCLUDED_SOURCE_ID
    );
  });
}

/**
 * Extract class availability from spell data
 * @param {object} spell - Spell object from D&D Beyond
 * @returns {Array<string>} - Array of class names
 */
function extractClassAvailability(spell) {
  const classes = [];

  // D&D Beyond stores class info in definition.classes
  const spellClasses = spell.definition?.classes || spell.classes || [];

  for (const classInfo of spellClasses) {
    // classInfo can be {id: 12, name: "Wizard"} or just {id: 12}
    const className = classInfo.name || CLASS_MAP[classInfo.id];

    if (className && !classes.includes(className)) {
      classes.push(className);
    }
  }

  return classes.sort(); // Sort alphabetically for consistency
}

/**
 * Extract subclass availability from spell data
 * @param {object} spell - Spell object from D&D Beyond
 * @returns {Array<string>} - Array of subclass names
 */
function extractSubclassAvailability(spell) {
  const subclasses = [];

  const spellSubclasses = spell.definition?.subclasses || spell.subclasses || [];

  for (const subclassInfo of spellSubclasses) {
    const subclassName = subclassInfo.name;
    if (subclassName && !subclasses.includes(subclassName)) {
      subclasses.push(subclassName);
    }
  }

  return subclasses.sort();
}

/**
 * Extract component information from spell
 * @param {object} spell - Spell object from D&D Beyond
 * @returns {object} - Component details
 */
function extractComponents(spell) {
  const definition = spell.definition || spell;

  return {
    verbal: definition.componentsArray?.includes(1) || false,
    somatic: definition.componentsArray?.includes(2) || false,
    material: definition.componentsArray?.includes(3) || false,
    materialDescription: definition.componentsDescription || null
  };
}

/**
 * Enhance spell object with additional metadata
 * @param {object} spell - Original spell object from D&D Beyond
 * @returns {object} - Enhanced spell object
 */
function enhanceSpellData(spell) {
  const definition = spell.definition || spell;

  return {
    // Preserve all original data
    ...spell,

    // Add enhanced fields
    availableToClasses: extractClassAvailability(spell),
    availableToSubclasses: extractSubclassAvailability(spell),

    // Ritual and concentration flags
    isRitual: definition.ritual === true || definition.isRitual === true,
    requiresConcentration: definition.concentration === true || definition.requiresConcentration === true,

    // Component details
    components: extractComponents(spell),

    // Spell school mapping
    school: definition.school?.name || SPELL_SCHOOL_MAP[definition.schoolId] || definition.school || 'Unknown',

    // Ensure level is present
    level: definition.level !== undefined ? definition.level : spell.level
  };
}

/**
 * Fetch spells for a specific spell level
 * @param {number} level - Spell level (0 = cantrips, 1-9 = spell levels)
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {Promise<Array>} - Array of spell objects for this level
 */
async function fetchSpellsByLevel(level, cobaltCookie) {
  const url = DDB_URLS.spells(level);

  try {
    // Get auth headers (with cached bearer token if available)
    const headers = await getAuthHeaders(cobaltCookie, true);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn(`[SPELLS] Level ${level} error: ${response.status} ${response.statusText}`);
      return [];
    }

    const json = await response.json();

    // Handle both {data: [...]} and [...] response formats
    const spells = json.data || json || [];

    if (!Array.isArray(spells)) {
      console.warn(`[SPELLS] Level ${level} returned non-array data`);
      return [];
    }

    console.log(`[SPELLS] Level ${level}: Fetched ${spells.length} spells`);
    return spells;

  } catch (error) {
    console.warn(`[SPELLS] Level ${level} fetch failed:`, error.message);
    return [];
  }
}

/**
 * Fetch all spells across all levels (0-9)
 * Fetches in parallel for better performance
 *
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {Promise<Array>} - Array of all spell objects with enhanced data
 */
export async function fetchAllSpells(cobaltCookie) {
  console.log('[SPELLS] Fetching spells across all levels (0-9)');

  // Fetch all levels in parallel
  const levelPromises = CONSTANTS.SPELL_LEVELS.map(level =>
    fetchSpellsByLevel(level, cobaltCookie)
  );

  const levelResults = await Promise.all(levelPromises);

  // Flatten results and deduplicate by spell ID
  const spellsMap = new Map();

  for (const spells of levelResults) {
    for (const spell of spells) {
      const spellId = spell.id;

      if (spellId && !spellsMap.has(spellId)) {
        // Enhance spell data with class availability and metadata
        const enhancedSpell = enhanceSpellData(spell);
        spellsMap.set(spellId, enhancedSpell);
      }
    }
  }

  // Convert Map to array
  const allSpells = Array.from(spellsMap.values());

  // Filter out Unearthed Arcana content
  const filteredSpells = filterUnearthedArcana(allSpells);

  console.log(`[SPELLS] Total: ${filteredSpells.length} spells (${allSpells.length - filteredSpells.length} UA filtered)`);

  // Log class availability stats
  const classStats = {};
  for (const spell of filteredSpells) {
    for (const className of spell.availableToClasses) {
      classStats[className] = (classStats[className] || 0) + 1;
    }
  }
  console.log('[SPELLS] Class availability stats:', classStats);

  return filteredSpells;
}

export default {
  fetchAllSpells
};
