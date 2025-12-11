/**
 * TTL-based In-Memory Cache
 *
 * Provides caching with automatic expiration based on time-to-live (TTL).
 * Each cache instance can have different expiration times.
 */

export class Cache {
  /**
   * Create a new cache instance
   * @param {string} name - Cache name for logging
   * @param {number} ttlMs - Time to live in milliseconds
   */
  constructor(name, ttlMs) {
    this.name = name;
    this.ttlMs = ttlMs;
    this.items = new Map();
  }

  /**
   * Check if a cached item exists and is not expired
   * @param {string} id - Cache key
   * @returns {{exists: boolean, data: any}} - Cached data if exists and valid
   */
  exists(id) {
    const cached = this.items.get(id);

    if (!cached) {
      return { exists: false, data: null };
    }

    // Check if expired
    if (this.isExpired(cached.timestamp)) {
      this.items.delete(id);
      console.log(`[CACHE ${this.name}] Expired entry removed: ${id.substring(0, 8)}...`);
      return { exists: false, data: null };
    }

    console.log(`[CACHE ${this.name}] Hit: ${id.substring(0, 8)}...`);
    return { exists: true, data: cached.data };
  }

  /**
   * Check if a timestamp is expired based on TTL
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {boolean} - True if expired
   */
  isExpired(timestamp) {
    return (Date.now() - timestamp) > this.ttlMs;
  }

  /**
   * Add data to cache with current timestamp
   * @param {string} id - Cache key
   * @param {any} data - Data to cache
   */
  add(id, data) {
    // Don't cache empty data
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.log(`[CACHE ${this.name}] Skipping empty data for: ${id.substring(0, 8)}...`);
      return null;
    }

    // Remove old entry if exists
    if (this.items.has(id)) {
      this.items.delete(id);
    }

    // Add new entry with timestamp
    this.items.set(id, {
      data: data,
      timestamp: Date.now()
    });

    const dataSize = Array.isArray(data) ? `${data.length} items` : 'object';
    console.log(`[CACHE ${this.name}] Added: ${id.substring(0, 8)}... (${dataSize})`);
  }

  /**
   * Remove a specific cache entry
   * @param {string} id - Cache key
   */
  remove(id) {
    const existed = this.items.delete(id);
    if (existed) {
      console.log(`[CACHE ${this.name}] Removed: ${id.substring(0, 8)}...`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.items.size;
    this.items.clear();
    console.log(`[CACHE ${this.name}] Cleared ${size} entries`);
  }

  /**
   * Get current cache size
   * @returns {number} - Number of cached entries
   */
  get size() {
    return this.items.size;
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache statistics
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [id, cached] of this.items.entries()) {
      if (this.isExpired(cached.timestamp)) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      name: this.name,
      ttl: this.ttlMs,
      ttlMinutes: Math.round(this.ttlMs / 60000),
      totalEntries: this.items.size,
      validEntries,
      expiredEntries
    };
  }

  /**
   * Clean up expired entries (optional maintenance)
   */
  cleanup() {
    const before = this.items.size;
    const now = Date.now();

    for (const [id, cached] of this.items.entries()) {
      if (this.isExpired(cached.timestamp)) {
        this.items.delete(id);
      }
    }

    const removed = before - this.items.size;
    if (removed > 0) {
      console.log(`[CACHE ${this.name}] Cleanup removed ${removed} expired entries`);
    }
  }
}

export default Cache;
