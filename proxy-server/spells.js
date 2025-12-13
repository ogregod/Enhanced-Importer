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
import { DDB_URLS, CONSTANTS, CLASS_MAP, SPELL_SCHOOL_MAP, SOURCE_BOOK_MAP } from './config.js';
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
 * Extract ALL source book names from spell sources array
 * @param {object} spell - Spell object from D&D Beyond
 * @returns {string} - Comma-separated source book names
 */
function extractSourceBook(spell) {
  const sources = spell.definition?.sources || spell.sources || [];
  const sourceNames = [];
  const unmappedIds = [];

  if (sources.length === 0) return 'Unknown Source';

  // Extract ALL source books (not just the first one)
  sources.forEach(source => {
    let sourceName = null;

    // Try to get source book name from the sourceBook property
    if (source.sourceBook) {
      sourceName = source.sourceBook;
    }
    // Fall back to mapping sourceId to source book name
    else if (source.sourceId && SOURCE_BOOK_MAP[source.sourceId]) {
      sourceName = SOURCE_BOOK_MAP[source.sourceId];
    }
    // Log unmapped source IDs
    else if (source.sourceId) {
      unmappedIds.push(source.sourceId);
    }

    // Add to list if we found a name and it's not already in the list
    if (sourceName && !sourceNames.includes(sourceName)) {
      sourceNames.push(sourceName);
    }
  });

  // Log any unmapped source IDs for debugging
  if (unmappedIds.length > 0) {
    const spellName = spell.definition?.name || spell.name || 'Unknown Spell';
    console.warn(`[SPELLS] Unmapped source IDs for "${spellName}":`, unmappedIds.join(', '));
  }

  return sourceNames.length > 0 ? sourceNames.join(', ') : 'Unknown Source';
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

    // CRITICAL: Explicitly extract name from definition to top level
    id: spell.id || definition.id,
    name: definition.name || spell.name || 'Unknown Spell',

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
    level: definition.level !== undefined ? definition.level : spell.level,

    // Extract other commonly used fields from definition
    description: definition.description || spell.description,
    castingTime: definition.castingTime || spell.castingTime,
    range: definition.range || spell.range,
    duration: definition.duration || spell.duration,

    // Extract source book name
    sourceBook: extractSourceBook(spell)
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

  // Flatten results and merge spells by NAME (not ID - D&D Beyond uses different IDs per class!)
  const spellsMap = new Map();
  let mergeCount = 0;
  let skippedCount = 0;

  for (const spells of classResults) {
    for (const spell of spells) {
      const spellName = spell.name;

      if (!spellName) {
        console.warn('[SPELLS] Skipping spell with no name:', spell.id || 'Unknown ID');
        skippedCount++;
        continue;
      }

      // Use spell name as key (D&D Beyond uses different IDs for same spell across classes!)
      if (spellsMap.has(spellName)) {
        // Spell already exists - merge class availability
        const existing = spellsMap.get(spellName);
        const beforeClasses = [...existing._classes];
        existing._classes = [...new Set([...existing._classes, ...spell._classes])];
        mergeCount++;
        console.log(`[SPELLS] Merged "${spellName}": ${beforeClasses.join(',')} + ${spell._classes.join(',')} = ${existing._classes.join(',')}`);
      } else {
        // New spell - add to map
        spellsMap.set(spellName, spell);
      }
    }
  }

  console.log(`[SPELLS] Deduplication complete: ${mergeCount} spells merged, ${skippedCount} skipped`);

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
