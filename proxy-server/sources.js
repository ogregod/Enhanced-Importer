/**
 * Sources Module
 *
 * Handles fetching and caching source book definitions from D&D Beyond's config API.
 * This ensures we always have accurate, up-to-date source book names instead of
 * relying on a manually maintained map.
 */

import fetch from 'node-fetch';
import { Cache } from './cache.js';
import { CACHE_TTL } from './config.js';

// Cache for D&D Beyond config (includes source definitions)
const configCache = new Cache('DDB_CONFIG', CACHE_TTL.CONFIG);

// D&D Beyond's config endpoint
const DDB_CONFIG_URL = 'https://www.dndbeyond.com/api/config/json';

/**
 * Fetch D&D Beyond's configuration which includes source book definitions
 * @returns {Promise<object>} - Config object with sources array
 */
export async function fetchDDBConfig() {
  // Check cache first
  const cached = configCache.get('config');
  if (cached) {
    console.log('[SOURCES] Using cached D&D Beyond config');
    return cached;
  }

  try {
    console.log('[SOURCES] Fetching D&D Beyond config from API...');
    const response = await fetch(DDB_CONFIG_URL, {
      headers: {
        'User-Agent': 'Enhanced-Importer/1.1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`D&D Beyond config API error: ${response.status}`);
    }

    const config = await response.json();

    // Cache the config
    configCache.set('config', config);
    console.log(`[SOURCES] Fetched D&D Beyond config (${config.sources?.length || 0} sources)`);

    return config;

  } catch (error) {
    console.error('[SOURCES] Failed to fetch D&D Beyond config:', error.message);
    // Return empty config if fetch fails
    return { sources: [] };
  }
}

/**
 * Get source book name from source ID using D&D Beyond's config
 * @param {number} sourceId - D&D Beyond source ID
 * @returns {Promise<string|null>} - Source book name or null if not found
 */
export async function getSourceNameById(sourceId) {
  const config = await fetchDDBConfig();

  if (!config.sources || !Array.isArray(config.sources)) {
    return null;
  }

  const source = config.sources.find(s => s.id === sourceId);
  return source?.name || null;
}

/**
 * Get all source books from D&D Beyond's config
 * @returns {Promise<Array>} - Array of {id, name, description} objects
 */
export async function getAllSources() {
  const config = await fetchDDBConfig();

  if (!config.sources || !Array.isArray(config.sources)) {
    console.warn('[SOURCES] No sources found in D&D Beyond config');
    return [];
  }

  // Return simplified source objects
  return config.sources.map(source => ({
    id: source.id,
    name: source.name,
    description: source.description || null,
    sourceCategory: source.sourceCategory || null
  }));
}

/**
 * Build a sourceId -> name mapping from D&D Beyond's config
 * @returns {Promise<Map<number, string>>} - Map of sourceId to source name
 */
export async function buildSourceMap() {
  const config = await fetchDDBConfig();

  const sourceMap = new Map();

  if (config.sources && Array.isArray(config.sources)) {
    for (const source of config.sources) {
      if (source.id && source.name) {
        sourceMap.set(source.id, source.name);
      }
    }
  }

  return sourceMap;
}

/**
 * Extract source book name from a source object
 * Tries multiple strategies in order:
 * 1. Use sourceBook property if present
 * 2. Look up sourceId in D&D Beyond's config
 * 3. Return sourceId as fallback
 *
 * @param {object} source - Source object from D&D Beyond API
 * @param {Map<number, string>} sourceMap - Pre-built source map (optional, for performance)
 * @returns {string} - Source book name
 */
export function extractSourceName(source, sourceMap = null) {
  // Strategy 1: Use sourceBook property if present
  if (source.sourceBook && typeof source.sourceBook === 'string') {
    return source.sourceBook;
  }

  // Strategy 2: Look up in source map
  if (sourceMap && source.sourceId) {
    const name = sourceMap.get(source.sourceId);
    if (name) {
      return name;
    }
  }

  // Strategy 3: Return sourceId as fallback (better than "Unknown")
  if (source.sourceId) {
    console.warn(`[SOURCES] Unknown sourceId ${source.sourceId}, using ID as fallback`);
    return `Source ${source.sourceId}`;
  }

  return 'Unknown Source';
}

export default {
  fetchDDBConfig,
  getSourceNameById,
  getAllSources,
  buildSourceMap,
  extractSourceName
};
