#!/usr/bin/env node

/**
 * D&D Beyond Foundry Proxy Server - Production Version
 *
 * A secure, production-ready proxy for D&D Beyond API access.
 * Designed to be hosted on platforms like Railway, Render, or AWS.
 *
 * Security Features:
 * - Cobalt cookies NEVER logged or stored
 * - Rate limiting per IP
 * - Request validation
 * - CORS properly configured
 * - Environment-based configuration
 *
 * Performance Features:
 * - Response caching (anonymous data only)
 * - Connection pooling
 * - Compression
 * - Request timeouts
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';

// Import new modules
import { Cache } from './cache.js';
import { getBearerToken, validateCobaltCookie as validateCobalt, getCacheId } from './auth.js';
import { DDB_URLS, CACHE_TTL, CONSTANTS } from './config.js';
import { fetchAllSpells } from './spells.js';
import { fetchAllItems } from './items.js';
import { getAllSources } from './sources.js';
import { generateCombinedReport } from './reports.js';

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy - Required for rate limiting behind reverse proxies (Render, Railway, etc.)
// Set to 1 for single reverse proxy (Render's load balancer)
app.set('trust proxy', 1);

// D&D Beyond API endpoints (legacy constants for backward compatibility)
const DDB_AUTH_SERVICE = DDB_URLS.authService;
const DDB_CHARACTER_SERVICE = DDB_URLS.characterService;
const DDB_GAME_DATA_BASE = `${DDB_CHARACTER_SERVICE}/game-data`;

// Create cache instances with TTL-based expiration
const spellsCache = new Cache('SPELLS', CACHE_TTL.SPELLS);
const itemsCache = new Cache('ITEMS', CACHE_TTL.ITEMS);

// Legacy cache for backward compatibility (deprecated)
const cache = new Map();
const CACHE_TTL_LEGACY = 3600000; // 1 hour

// Track recent imports for combined report generation
const recentImports = {
  items: null,
  spells: null,
  lastUpdate: {
    items: 0,
    spells: 0
  }
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow module to make requests
}));

// Compression
app.use(compression());

// CORS - Allow Foundry VTT to connect
app.use(cors({
  origin: true, // Allow all origins (Foundry can run on any port)
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Rate limiting - Prevent abuse while allowing large imports
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per windowMs per IP (increased to support large imports)
  message: {
    error: 'Too many requests',
    message: 'Please wait before making more requests.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging (NEVER log cookies!)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const safeHeaders = { ...req.headers };
  delete safeHeaders.cookie; // Remove cookies from logs
  delete safeHeaders.authorization; // Remove auth from logs

  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get cached response if available and not expired (LEGACY - for backward compatibility)
 * @deprecated Use Cache instances (spellsCache, itemsCache) instead
 */
function getCached(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL_LEGACY) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set cache with timestamp (LEGACY - for backward compatibility)
 * @deprecated Use Cache instances (spellsCache, itemsCache) instead
 */
function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Make authenticated request to D&D Beyond
 * IMPORTANT: Cookie is NEVER logged or stored
 */
async function makeAuthenticatedRequest(url, cobaltCookie, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`D&D Beyond API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - D&D Beyond is taking too long to respond');
    }
    throw error;
  }
}

// ============================================================================
// HEALTH & STATUS ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: NODE_ENV,
    caches: {
      spells: spellsCache.getStats(),
      items: itemsCache.getStats()
    }
  });
});

/**
 * Ping endpoint for quick availability check
 */
app.get('/ping', (req, res) => {
  res.json({ pong: true });
});

/**
 * Get available source books from D&D Beyond's config API
 */
app.get('/api/source-books', async (req, res) => {
  try {
    // Fetch source books from D&D Beyond's config API (cached)
    const sources = await getAllSources();

    // Filter and format for frontend
    const sourceBooks = sources
      .filter(source => source.id && source.name) // Only include valid sources
      .map(source => ({
        id: source.id,
        name: source.name,
        description: source.description || null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[API] Returning ${sourceBooks.length} source books`);
    res.json({ sourceBooks });
  } catch (error) {
    console.error('[API] Failed to fetch source books:', error.message);
    res.status(500).json({
      error: 'Failed to fetch source books',
      message: error.message
    });
  }
});

/**
 * Stats endpoint (optional - can be disabled in production)
 */
app.get('/stats', (req, res) => {
  if (NODE_ENV === 'production' && !req.headers['x-admin-key']) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({
    version: '1.1.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    caches: {
      spells: spellsCache.getStats(),
      items: itemsCache.getStats(),
      legacy: cache.size
    }
  });
});

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validate Cobalt cookie is present
 */
function validateCobaltCookie(req, res, next) {
  const { cobaltCookie } = req.body;

  if (!cobaltCookie || typeof cobaltCookie !== 'string') {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Cobalt cookie is required'
    });
  }

  // Basic validation - should be a reasonable length JWT-like string
  if (cobaltCookie.length < 20 || cobaltCookie.length > 2000) {
    return res.status(400).json({
      error: 'Invalid cookie',
      message: 'Cobalt cookie format is invalid'
    });
  }

  next();
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Validate Cobalt cookie by testing it with D&D Beyond
 */
app.post('/api/validate-cookie', validateCobaltCookie, async (req, res) => {
  const { cobaltCookie } = req.body;

  try {
    // Use new auth module to validate and get bearer token
    const result = await validateCobalt(cobaltCookie);

    if (!result.valid) {
      return res.status(401).json({
        valid: false,
        message: result.message || 'Cookie is invalid or expired'
      });
    }

    // Get the bearer token (will be cached)
    const token = await getBearerToken(cobaltCookie);

    res.json({
      valid: true,
      token: token
    });

  } catch (error) {
    console.error('Cookie validation failed:', error.message);
    res.status(401).json({
      valid: false,
      message: 'Cookie is invalid or expired'
    });
  }
});

/**
 * Proxy Character Service requests
 * Route: POST /api/character/*
 */
app.post('/api/character/*', validateCobaltCookie, async (req, res) => {
  const { cobaltCookie } = req.body;
  const endpoint = req.path.replace('/api/character', '');

  try {
    const data = await makeAuthenticatedRequest(
      `${DDB_CHARACTER_SERVICE}${endpoint}`,
      cobaltCookie
    );

    res.json(data);

  } catch (error) {
    console.error(`Character service error (${endpoint}):`, error.message);
    res.status(error.message.includes('timeout') ? 504 : 500).json({
      error: 'API request failed',
      message: error.message
    });
  }
});

/**
 * Proxy Game Data API requests (items, spells, sources)
 * Route: POST /api/content/*
 */
app.post('/api/content/*', async (req, res) => {
  const { cobaltCookie, bustCache, sourceBookIds } = req.body;
  const endpoint = req.path.replace('/api/content', '');

  try {
    let url;
    let data;

    // Map endpoints to correct D&D Beyond game-data URLs
    if (endpoint === '/items') {
      // NEW: Use enhanced item fetching with source book extraction
      const baseCacheId = getCacheId(cobaltCookie);
      // Include sourceBookIds in cache key if provided
      const cacheId = sourceBookIds && sourceBookIds.length > 0
        ? `${baseCacheId}_sources_${sourceBookIds.sort().join('_')}`
        : baseCacheId;

      // Check cache first (unless bustCache is true)
      if (!bustCache) {
        const cached = itemsCache.exists(cacheId);
        if (cached.exists) {
          console.log('[ITEMS] Returning cached items');
          return res.json(cached.data);
        }
      } else {
        console.log('[ITEMS] Cache busting enabled - forcing fresh fetch');
      }

      // Fetch items with enhanced data (source books, etc.)
      console.log('[ITEMS] Fetching enhanced item data...');
      const itemsData = await fetchAllItems(cobaltCookie, sourceBookIds);

      // Store for combined report
      recentImports.items = itemsData;
      recentImports.lastUpdate.items = Date.now();

      // Cache the items array (for backward compatibility)
      itemsCache.add(cacheId, itemsData.items);

      // Generate combined report if both items and spells were fetched recently (within 5 minutes)
      const timeDiff = Math.abs(recentImports.lastUpdate.items - recentImports.lastUpdate.spells);
      if (recentImports.spells && timeDiff < 300000) { // 5 minutes
        generateCombinedReport(recentImports.items, recentImports.spells);
      }

      console.log(`[ITEMS] Returning ${itemsData.items.length} enhanced items`);
      return res.json(itemsData.items);

    } else if (endpoint === '/spells') {
      // NEW: Use enhanced spell fetching with class availability
      const baseCacheId = getCacheId(cobaltCookie);
      // Include sourceBookIds in cache key if provided
      const cacheId = sourceBookIds && sourceBookIds.length > 0
        ? `${baseCacheId}_sources_${sourceBookIds.sort().join('_')}`
        : baseCacheId;

      // Check cache first (unless bustCache is true)
      if (!bustCache) {
        const cached = spellsCache.exists(cacheId);
        if (cached.exists) {
          console.log('[SPELLS] Returning cached spells');
          return res.json(cached.data);
        }
      } else {
        console.log('[SPELLS] Cache busting enabled - forcing fresh fetch');
      }

      // Fetch spells with enhanced data (class availability, ritual, concentration, etc.)
      console.log('[SPELLS] Fetching enhanced spell data...');
      const spellsData = await fetchAllSpells(cobaltCookie, sourceBookIds);

      // Store for combined report
      recentImports.spells = spellsData;
      recentImports.lastUpdate.spells = Date.now();

      // Cache the spells array (for backward compatibility)
      spellsCache.add(cacheId, spellsData.spells);

      // Generate combined report if both items and spells were fetched recently (within 5 minutes)
      const timeDiff = Math.abs(recentImports.lastUpdate.items - recentImports.lastUpdate.spells);
      if (recentImports.items && timeDiff < 300000) { // 5 minutes
        generateCombinedReport(recentImports.items, recentImports.spells);
      }

      console.log(`[SPELLS] Returning ${spellsData.spells.length} enhanced spells`);
      return res.json(spellsData.spells);

    } else if (endpoint === '/sources') {
      // Sources don't exist as an endpoint - this should fall back to local
      throw new Error('Sources endpoint not available from D&D Beyond API');
    } else {
      // Generic game-data endpoint
      url = `${DDB_GAME_DATA_BASE}${endpoint}`;
    }

    if (cobaltCookie) {
      // Authenticated request - use new auth module
      console.log(`[API] Fetching ${endpoint} with authentication`);

      // Get bearer token (cached or fetch new)
      const bearerToken = await getBearerToken(cobaltCookie);

      // Make authenticated GET request with bearer token (no Content-Type)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'User-Agent': CONSTANTS.USER_AGENT,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`D&D Beyond API error: ${response.status} ${response.statusText}`);
      }

      data = await response.json();

    } else {
      // Anonymous request (public data)
      console.log(`[API] Fetching ${endpoint} anonymously`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': CONSTANTS.USER_AGENT,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`D&D Beyond API error: ${response.status} ${response.statusText}`);
      }

      data = await response.json();
    }

    res.json(data);

  } catch (error) {
    console.error(`Game Data API error (${endpoint}):`, error.message);
    res.status(error.message.includes('timeout') ? 504 : 500).json({
      error: 'API request failed',
      message: error.message
    });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.path} does not exist`,
    availableEndpoints: [
      'GET  /health',
      'GET  /ping',
      'POST /api/validate-cookie',
      'POST /api/character/*',
      'POST /api/content/*'
    ]
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const server = app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   D&D Beyond Foundry Proxy Server (Production)     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`✓ Environment: ${NODE_ENV}`);
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Ready to serve requests\n`);

  if (NODE_ENV === 'production') {
    console.log('🔒 Production mode enabled');
    console.log('   - Rate limiting active');
    console.log('   - Security headers enabled');
    console.log('   - Cookies are NEVER logged\n');
  }
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

function gracefulShutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log('Server closed');

    // Clear all caches
    spellsCache.clear();
    itemsCache.clear();
    cache.clear();

    console.log('Caches cleared');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
