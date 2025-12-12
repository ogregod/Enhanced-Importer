/**
 * Items Module
 *
 * Handles fetching and processing item data from D&D Beyond:
 * - Fetches items with enhanced metadata
 * - Extracts source book information
 * - Filters Unearthed Arcana content
 */

import fetch from 'node-fetch';
import { DDB_URLS, CONSTANTS, SOURCE_BOOK_MAP } from './config.js';
import { getAuthHeaders } from './auth.js';

/**
 * Extract ALL source book names from item sources array
 * @param {object} item - Item object from D&D Beyond
 * @returns {string} - Comma-separated source book names
 */
function extractSourceBook(item) {
  const sources = item.sources || [];
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
    console.warn(`[ITEMS] Unmapped source IDs for "${item.name}":`, unmappedIds.join(', '));
  }

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
 * @returns {object} - Enhanced item object
 */
function enhanceItemData(item) {
  return {
    // Preserve all original data
    ...item,

    // Extract source book name to top level
    sourceBook: extractSourceBook(item),

    // Ensure id is present
    id: item.id,

    // Ensure name is present
    name: item.name || 'Unknown Item',

    // Ensure description is present
    description: item.description || item.snippet || ''
  };
}

/**
 * Fetch all items from D&D Beyond
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {Promise<Array>} - Array of enhanced item objects
 */
export async function fetchAllItems(cobaltCookie) {
  console.log('[ITEMS] Fetching items from D&D Beyond...');

  try {
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

    console.log(`[ITEMS] Fetched ${items.length} items`);

    // Enhance each item with source book information
    const enhancedItems = items.map(item => enhanceItemData(item));

    // Filter out Unearthed Arcana content
    const filteredItems = filterUnearthedArcana(enhancedItems);

    console.log(`[ITEMS] Total: ${filteredItems.length} items (${enhancedItems.length - filteredItems.length} UA filtered)`);

    // Log source stats
    const sourceStats = {};
    for (const item of filteredItems) {
      const source = item.sourceBook || 'Unknown';
      sourceStats[source] = (sourceStats[source] || 0) + 1;
    }
    console.log('[ITEMS] Source distribution:', sourceStats);

    return filteredItems;

  } catch (error) {
    console.error('[ITEMS] Fetch failed:', error.message);
    throw error;
  }
}

export default {
  fetchAllItems
};
