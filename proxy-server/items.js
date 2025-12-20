/**
 * Items Module
 *
 * Handles fetching and processing item data from D&D Beyond:
 * - Fetches items with enhanced metadata
 * - Extracts source book information
 * - Filters Unearthed Arcana content
 */

import fetch from 'node-fetch';
import { DDB_URLS, CONSTANTS, RARITY_MAP } from './config.js';
import { getAuthHeaders } from './auth.js';
import { buildSourceMap, extractSourceName, getAllSources } from './sources.js';

/**
 * Extract ALL source book names from item sources array
 * Uses D&D Beyond's config API for accurate source book names
 * @param {object} item - Item object from D&D Beyond
 * @param {Map<number, string>} sourceMap - Pre-built source map from D&D Beyond config
 * @returns {string} - Comma-separated source book names
 */
function extractSourceBook(item, sourceMap) {
  const sources = item.sources || [];
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
 * Filter out Unearthed Arcana content (sourceId 39)
 * @param {Array} items - Array of item objects
 * @returns {Array} - Filtered item array
 */
function filterUnearthedArcana(items) {
  return items.filter(item => {
    // Check if item has sources
    if (!item.sources) {
      return true; // Include if no source info
    }

    const sources = item.sources || [];

    // Filter out if any source is UA (sourceId 39)
    return !sources.some(source =>
      source.sourceId === CONSTANTS.EXCLUDED_SOURCE_ID
    );
  });
}

/**
 * Enhance item object with additional metadata
 * @param {object} item - Original item object from D&D Beyond
 * @param {Map<number, string>} sourceMap - Pre-built source map from D&D Beyond config
 * @returns {object} - Enhanced item object
 */
function enhanceItemData(item, sourceMap) {
  // Get rarity ID from the item (handle both direct and nested formats)
  const rarityId = item.rarity !== undefined ? item.rarity : (item.definition?.rarity);

  // DEBUG: Log rarity mapping for first 5 items to diagnose issues
  if (typeof enhanceItemData.debugCount === 'undefined') {
    enhanceItemData.debugCount = 0;
  }
  if (enhanceItemData.debugCount < 5) {
    console.log(`[ITEMS DEBUG] Item "${item.name}" full structure:`, {
      rawRarity: item.rarity,
      rarityType: typeof item.rarity,
      definitionRarity: item.definition?.rarity,
      rarityId,
      mappedName: RARITY_MAP[rarityId !== null && rarityId !== undefined ? rarityId : 0],
      itemKeys: Object.keys(item),
      hasDefinition: !!item.definition,
      definitionKeys: item.definition ? Object.keys(item.definition) : null
    });
    enhanceItemData.debugCount++;
  }

  // Map rarity ID to rarity name
  // If rarityId is null/undefined, default to 0 (Mundane)
  // If rarity ID is not in the map, default to 'Mundane' instead of 'Unknown'
  const rarityName = RARITY_MAP[rarityId !== null && rarityId !== undefined ? rarityId : 0] || 'Mundane';

  return {
    // Preserve all original data
    ...item,

    // Extract source book name to top level
    sourceBook: extractSourceBook(item, sourceMap),

    // Add human-readable rarity name
    // CRITICAL: Mundane (0) vs Common (1) distinction!
    rarityName: rarityName,

    // Ensure id is present
    id: item.id,

    // Ensure name is present
    name: item.name || 'Unknown Item',

    // Ensure description is present
    description: item.description || item.snippet || ''
  };
}

/**
 * Filter items by source book IDs
 * @param {Array} items - Array of item objects
 * @param {Array<number>} sourceBookIds - Array of source book IDs to include
 * @returns {Array} - Filtered item array
 */
function filterBySourceBooks(items, sourceBookIds) {
  if (!sourceBookIds || sourceBookIds.length === 0) {
    return items; // No filter, return all
  }

  // DEBUG: Log first item's source structure to understand format
  if (items.length > 0) {
    const firstItem = items[0];
    const sources = firstItem.sources || [];
    console.log('[ITEMS DEBUG] First item source structure:', {
      itemName: firstItem.name,
      sources: sources,
      sourceIds: sources.map(s => s.sourceId),
      requestedSourceIds: sourceBookIds
    });
  }

  const filtered = items.filter(item => {
    const sources = item.sources || [];
    // Include item if ANY of its source IDs match the filter
    return sources.some(source => sourceBookIds.includes(source.sourceId));
  });

  // DEBUG: Log filtering results
  console.log(`[ITEMS DEBUG] Filtered ${items.length} items to ${filtered.length} items`);
  if (filtered.length === 0 && items.length > 0) {
    console.warn('[ITEMS DEBUG] No items matched source filter. Sample item sources:');
    for (let i = 0; i < Math.min(5, items.length); i++) {
      const item = items[i];
      const sources = item.sources || [];
      console.warn(`  - "${item.name}": sourceIds =`, sources.map(s => s.sourceId));
    }
  }

  return filtered;
}

/**
 * Fetch all items from D&D Beyond
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @param {Array<number>} sourceBookIds - Optional array of source book IDs to filter by
 * @returns {Promise<Array>} - Array of enhanced item objects
 */
export async function fetchAllItems(cobaltCookie, sourceBookIds = null) {
  const filterMsg = sourceBookIds && sourceBookIds.length > 0
    ? ` (filtering by source IDs: ${sourceBookIds.join(', ')})`
    : '';
  console.log(`[ITEMS] Fetching items from D&D Beyond${filterMsg}...`);

  try {
    // Build source map from D&D Beyond config (cached)
    console.log('[ITEMS] Building source map from D&D Beyond config...');
    const sourceMap = await buildSourceMap();
    console.log(`[ITEMS] Source map built with ${sourceMap.size} sources`);

    // Get auth headers (with cached bearer token if available)
    const headers = await getAuthHeaders(cobaltCookie, true);

    const url = DDB_URLS.items(2); // sharingSetting=2 for all shared content

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn(`[ITEMS] Error: ${response.status} ${response.statusText}`);
      throw new Error(`D&D Beyond API error: ${response.status}`);
    }

    const json = await response.json();

    // D&D Beyond returns items directly in an array
    let items = json;

    // Handle different response formats
    if (json.data && Array.isArray(json.data)) {
      items = json.data;
    } else if (!Array.isArray(json)) {
      console.warn('[ITEMS] Unexpected response format');
      throw new Error('Unexpected response format from D&D Beyond');
    }

    console.log(`[ITEMS] Fetched ${items.length} items from D&D Beyond`);

    // IMPORTANT: Track ownership from ORIGINAL API response (before filtering)
    // A book is "owned" if ANY of its sourceIds appear in the API response
    const ownedSourceIds = new Set();
    for (const item of items) {
      const sources = item.sources || [];
      for (const source of sources) {
        if (source.sourceId) {
          ownedSourceIds.add(source.sourceId);
        }
      }
    }
    console.log(`[ITEMS] Detected ownership for ${ownedSourceIds.size} unique source IDs from API response`);

    // Filter by source books if specified (BEFORE enhancement)
    if (sourceBookIds && sourceBookIds.length > 0) {
      items = filterBySourceBooks(items, sourceBookIds);
      console.log(`[ITEMS] After source filter: ${items.length} items`);
    }

    // Enhance each item with source book information
    const enhancedItems = items.map(item => enhanceItemData(item, sourceMap));

    // Filter out Unearthed Arcana content
    const filteredItems = filterUnearthedArcana(enhancedItems);

    console.log(`[ITEMS] Total: ${filteredItems.length} items (${enhancedItems.length - filteredItems.length} UA filtered)`);

    // Log detailed source stats
    const sourceStats = {};
    for (const item of filteredItems) {
      const source = item.sourceBook || 'Unknown';
      sourceStats[source] = (sourceStats[source] || 0) + 1;
    }

    // Get all sources from D&D Beyond config
    const allSources = await getAllSources();

    // Build ownership map (sourceId -> owned status)
    const ownershipBySourceId = new Map();
    for (const source of allSources) {
      ownershipBySourceId.set(source.id, ownedSourceIds.has(source.id));
    }

    // Return both filtered items and ownership data for combined report
    return {
      items: filteredItems,
      sourceStats,
      ownershipBySourceId,
      allSources
    };

  } catch (error) {
    console.error('[ITEMS] Fetch failed:', error.message);
    throw error;
  }
}

export default {
  fetchAllItems
};
