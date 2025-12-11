/**
 * Authentication Module
 *
 * Handles D&D Beyond authentication:
 * - Exchanges Cobalt cookies for bearer tokens
 * - Caches bearer tokens to reduce auth service load
 * - Provides authenticated request headers
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import { Cache } from './cache.js';
import { DDB_URLS, CACHE_TTL, CONSTANTS } from './config.js';

// Create auth cache with 5-minute TTL (bearer tokens expire quickly)
export const authCache = new Cache('AUTH', CACHE_TTL.AUTH);

/**
 * Generate cache ID from cobalt cookie using SHA-256 hash
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {string} - SHA-256 hash for cache key
 */
export function getCacheId(cobaltCookie) {
  return crypto.createHash('sha256').update(cobaltCookie).digest('hex');
}

/**
 * Exchange Cobalt cookie for bearer token
 * Caches the result for 5 minutes to reduce auth service load
 *
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {Promise<string>} - Bearer token
 * @throws {Error} - If authentication fails
 */
export async function getBearerToken(cobaltCookie) {
  const cacheId = getCacheId(cobaltCookie);

  // Check cache first
  const cached = authCache.exists(cacheId);
  if (cached.exists) {
    return cached.data;
  }

  console.log('[AUTH] Exchanging cobalt cookie for bearer token');

  // Exchange cobalt cookie for bearer token
  try {
    const response = await fetch(`${DDB_URLS.authService}/cobalt-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'User-Agent': CONSTANTS.USER_AGENT
      }
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        throw new Error('Invalid or expired Cobalt cookie');
      }
      throw new Error(`Auth service error: ${status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.token || data.token.length === 0) {
      throw new Error('No bearer token received from D&D Beyond');
    }

    // Cache the bearer token
    authCache.add(cacheId, data.token);

    console.log('[AUTH] Bearer token obtained and cached');

    return data.token;

  } catch (error) {
    console.error('[AUTH] Bearer token exchange failed:', error.message);
    throw error;
  }
}

/**
 * Create authenticated request headers
 * Uses cached bearer token if available, otherwise exchanges cobalt cookie
 *
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @param {boolean} requireAuth - Whether to fetch bearer token now (default: false)
 * @param {boolean} includeContentType - Whether to include Content-Type header (default: false, only for POST/PUT)
 * @returns {Promise<object>} - Headers object for fetch requests
 */
export async function getAuthHeaders(cobaltCookie, requireAuth = false, includeContentType = false) {
  const headers = {
    'User-Agent': CONSTANTS.USER_AGENT,
    'Accept': 'application/json'
  };

  // Only include Content-Type for POST/PUT requests, not GET
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (requireAuth) {
    // Get bearer token (from cache or fetch new)
    const bearerToken = await getBearerToken(cobaltCookie);
    headers['Authorization'] = `Bearer ${bearerToken}`;
  } else {
    // Check if we have a cached token
    const cacheId = getCacheId(cobaltCookie);
    const cached = authCache.exists(cacheId);

    if (cached.exists && cached.data) {
      headers['Authorization'] = `Bearer ${cached.data}`;
    }
  }

  return headers;
}

/**
 * Create headers with Cobalt cookie (for direct cookie authentication)
 * Some D&D Beyond endpoints accept Cobalt cookies directly
 *
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {object} - Headers object with Cobalt cookie
 */
export function getCobaltHeaders(cobaltCookie) {
  return {
    'User-Agent': CONSTANTS.USER_AGENT,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Cookie': `CobaltSession=${cobaltCookie}`
  };
}

/**
 * Validate a Cobalt cookie by testing authentication
 *
 * @param {string} cobaltCookie - User's D&D Beyond session cookie
 * @returns {Promise<{valid: boolean, message?: string}>}
 */
export async function validateCobaltCookie(cobaltCookie) {
  try {
    await getBearerToken(cobaltCookie);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: error.message || 'Invalid or expired cookie'
    };
  }
}

export default {
  authCache,
  getCacheId,
  getBearerToken,
  getAuthHeaders,
  getCobaltHeaders,
  validateCobaltCookie
};
