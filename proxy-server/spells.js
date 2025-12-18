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
import { buildSourceMap, extractSourceName, getAllSources } from './sources.js';

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
 * Uses D&D Beyond's config API for accurate source book names
 * @param {object} spell - Spell object from D&D Beyond
 * @param {Map<number, string>} sourceMap - Pre-built source map from D&D Beyond config
 * @returns {string} - Comma-separated source book names
 */
function extractSourceBook(spell, sourceMap) {
  const sources = spell.definition?.sources || spell.sources || [];
  const sourceNames = [];

  if (sources.length === 0) return 'Unknown Source';

  // Extract ALL source books (not just the first one)
  sources.forEach(source => {
    const sourceName = extractSourceName(source, sourceMap);

    // Add to list if we found a name and it's not already in the list
    if (sourceName && !sourceNames.includes(sourceName)) {
      sourceNames.push(sourceName);
    }
  });

  return sourceNames.length > 0 ? sourceNames.join(', ') : 'Unknown Source';
}

/**
 * Enhance spell object with additional metadata
 * @param {object} spell - Original spell object from D&D Beyond
 * @param {string} className - Name of the class this spell was fetched for
 * @param {Map<number, string>} sourceMap - Pre-built source map from D&D Beyond config
 * @returns {object} - Enhanced spell object
 */
function enhanceSpellData(spell, className, sourceMap) {
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
    sourceBook: extractSourceBook(spell, sourceMap)
  };
}

/**
 * Fetch spells for a specific class
 * @param {number} classId - D&D Beyond class ID
 * @param {string} className - Class name (e.g., "Wizard")
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @param {Map<number, string>} sourceMap - Pre-built source map from D&D Beyond config
 * @returns {Promise<Array>} - Array of spell objects for this class
 */
async function fetchSpellsByClass(classId, className, cobaltCookie, sourceMap) {
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
    return spells.map(spell => enhanceSpellData(spell, className, sourceMap));

  } catch (error) {
    console.warn(`[SPELLS] ${className} fetch failed:`, error.message);
    return [];
  }
}

/**
 * Filter spells by source book IDs
 * @param {Array} spells - Array of spell objects
 * @param {Array<number>} sourceBookIds - Array of source book IDs to include
 * @returns {Array} - Filtered spell array
 */
function filterBySourceBooks(spells, sourceBookIds) {
  if (!sourceBookIds || sourceBookIds.length === 0) {
    return spells; // No filter, return all
  }

  // DEBUG: Log first spell's source structure to understand format
  if (spells.length > 0) {
    const firstSpell = spells[0];
    const sources = firstSpell.definition?.sources || firstSpell.sources || [];
    console.log('[SPELLS DEBUG] First spell source structure:', {
      spellName: firstSpell.definition?.name || firstSpell.name,
      sources: sources,
      sourceIds: sources.map(s => s.sourceId),
      requestedSourceIds: sourceBookIds
    });
  }

  const filtered = spells.filter(spell => {
    const sources = spell.definition?.sources || spell.sources || [];
    // Include spell if ANY of its source IDs match the filter
    return sources.some(source => sourceBookIds.includes(source.sourceId));
  });

  // DEBUG: If no spells matched, log some examples
  if (filtered.length === 0 && spells.length > 0) {
    console.warn('[SPELLS DEBUG] No spells matched source filter. Sample spell sources:');
    for (let i = 0; i < Math.min(5, spells.length); i++) {
      const spell = spells[i];
      const sources = spell.definition?.sources || spell.sources || [];
      console.warn(`  - "${spell.definition?.name || spell.name}": sourceIds =`, sources.map(s => s.sourceId));
    }
  }

  return filtered;
}

/**
 * Fetch all spells across all spellcasting classes
 * Fetches in parallel for better performance
 *
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @param {Array<number>} sourceBookIds - Optional array of source book IDs to filter by
 * @returns {Promise<Array>} - Array of all spell objects with enhanced data
 */
export async function fetchAllSpells(cobaltCookie, sourceBookIds = null) {
  const filterMsg = sourceBookIds && sourceBookIds.length > 0
    ? ` (filtering by source IDs: ${sourceBookIds.join(', ')})`
    : '';
  console.log(`[SPELLS] Fetching spells for ${CONSTANTS.SPELLCASTING_CLASSES.length} classes${filterMsg}...`);

  // Build source map from D&D Beyond config (cached)
  console.log('[SPELLS] Building source map from D&D Beyond config...');
  const sourceMap = await buildSourceMap();
  console.log(`[SPELLS] Source map built with ${sourceMap.size} sources`);

  // Fetch all classes in parallel
  const classPromises = CONSTANTS.SPELLCASTING_CLASSES.map(({ id, name }) =>
    fetchSpellsByClass(id, name, cobaltCookie, sourceMap)
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

  // IMPORTANT: Track ownership from ORIGINAL API response (before filtering)
  // A book is "owned" if ANY of its sourceIds appear in the API response
  const ownedSourceIds = new Set();
  for (const spell of allSpells) {
    const sources = spell.definition?.sources || spell.sources || [];
    for (const source of sources) {
      if (source.sourceId) {
        ownedSourceIds.add(source.sourceId);
      }
    }
  }
  console.log(`[SPELLS] Detected ownership for ${ownedSourceIds.size} unique source IDs from API response`);

  // Filter out Unearthed Arcana content
  let filteredSpells = filterUnearthedArcana(allSpells);

  console.log(`[SPELLS] Total: ${filteredSpells.length} spells (${allSpells.length - filteredSpells.length} UA filtered)`);

  // Filter by source books if specified
  if (sourceBookIds && sourceBookIds.length > 0) {
    const beforeSourceFilter = filteredSpells.length;
    filteredSpells = filterBySourceBooks(filteredSpells, sourceBookIds);
    console.log(`[SPELLS] After source filter: ${filteredSpells.length} spells (${beforeSourceFilter - filteredSpells.length} filtered)`);
  }

  // Log class availability stats
  const classStats = {};
  for (const spell of filteredSpells) {
    for (const className of spell.availableToClasses) {
      classStats[className] = (classStats[className] || 0) + 1;
    }
  }
  console.log('[SPELLS] Class availability stats:', classStats);

  // Log detailed source stats
  const sourceStats = {};
  for (const spell of filteredSpells) {
    const source = spell.sourceBook || 'Unknown';
    sourceStats[source] = (sourceStats[source] || 0) + 1;
  }

  // Get all sources from D&D Beyond config
  const allSources = await getAllSources();

  // Build ownership map (sourceId -> owned status)
  const ownershipBySourceId = new Map();
  for (const source of allSources) {
    ownershipBySourceId.set(source.id, ownedSourceIds.has(source.id));
  }

  // Return both filtered spells and ownership data for combined report
  return {
    spells: filteredSpells,
    sourceStats,
    ownershipBySourceId,
    allSources
  };
}

export default {
  fetchAllSpells
};
