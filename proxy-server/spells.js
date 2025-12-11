/**
 * Spells Module
 *
 * Handles fetching and processing spell data from D&D Beyond:
 * - Fetches spells by class (Wizard, Sorcerer, etc.) at max level
 * - Extracts class availability for each spell
 * - Extracts ritual, concentration, and component data
 * - Filters Unearthed Arcana content
 * - Deduplicates spells by ID
 *
 * NOTE: D&D Beyond API requires classId and classLevel parameters.
 * We fetch for all spellcasting classes at level 20 to get complete spell lists.
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
 * @param {string} className - Name of the class this spell was fetched for
 * @returns {object} - Enhanced spell object
 */
function enhanceSpellData(spell, className) {
  const definition = spell.definition || spell;

  return {
    // Preserve all original data
    ...spell,

    // Add class availability (will be merged later)
    _classes: [className], // Temporary field for merging

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
 * Fetch spells for a specific class
 * @param {number} classId - D&D Beyond class ID
 * @param {string} className - Class name (e.g., "Wizard")
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {Promise<Array>} - Array of spell objects for this class
 */
async function fetchSpellsByClass(classId, className, cobaltCookie) {
  // Fetch at max level (20) to get all spells available to the class
  const url = DDB_URLS.spells(classId, CONSTANTS.MAX_CLASS_LEVEL);

  try {
    // Get auth headers (with cached bearer token if available)
    const headers = await getAuthHeaders(cobaltCookie, true);

    console.log(`[SPELLS] Fetching spells for ${className} (classId: ${classId})...`);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn(`[SPELLS] ${className} error: ${response.status} ${response.statusText}`);
      return [];
    }

    const json = await response.json();

    // D&D Beyond returns {success: true, data: [...]}
    if (!json.success || !json.data) {
      console.warn(`[SPELLS] ${className} returned invalid data`);
      return [];
    }

    const spells = json.data;

    if (!Array.isArray(spells)) {
      console.warn(`[SPELLS] ${className} returned non-array data`);
      return [];
    }

    console.log(`[SPELLS] ${className}: Fetched ${spells.length} spells`);
    return spells.map(spell => enhanceSpellData(spell, className));

  } catch (error) {
    console.warn(`[SPELLS] ${className} fetch failed:`, error.message);
    return [];
  }
}

/**
 * Fetch all spells across all spellcasting classes
 * Fetches in parallel for better performance
 *
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {Promise<Array>} - Array of all spell objects with enhanced data
 */
export async function fetchAllSpells(cobaltCookie) {
  console.log(`[SPELLS] Fetching spells for ${CONSTANTS.SPELLCASTING_CLASSES.length} classes...`);

  // Fetch all classes in parallel
  const classPromises = CONSTANTS.SPELLCASTING_CLASSES.map(({ id, name }) =>
    fetchSpellsByClass(id, name, cobaltCookie)
  );

  const classResults = await Promise.all(classPromises);

  // Flatten results and merge spells by ID
  const spellsMap = new Map();

  for (const spells of classResults) {
    for (const spell of spells) {
      const spellId = spell.id;

      if (!spellId) continue;

      if (spellsMap.has(spellId)) {
        // Spell already exists - merge class availability
        const existing = spellsMap.get(spellId);
        existing._classes = [...new Set([...existing._classes, ...spell._classes])];
      } else {
        // New spell - add to map
        spellsMap.set(spellId, spell);
      }
    }
  }

  // Convert Map to array and finalize class availability
  const allSpells = Array.from(spellsMap.values()).map(spell => {
    const { _classes, ...rest } = spell;
    return {
      ...rest,
      availableToClasses: _classes.sort(), // Replace temporary _classes with final availableToClasses
      availableToSubclasses: [] // TODO: Extract subclass availability if needed
    };
  });

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
