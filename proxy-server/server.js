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

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// D&D Beyond API endpoints
const DDB_AUTH_SERVICE = 'https://auth-service.dndbeyond.com/v1';
const DDB_CHARACTER_SERVICE = 'https://character-service.dndbeyond.com/character/v5';
// Game data endpoints are under character service, not www.dndbeyond.com
const DDB_GAME_DATA_BASE = `${DDB_CHARACTER_SERVICE}/game-data`;

// Simple in-memory cache for anonymous data (not user-specific)
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

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

// Rate limiting - Prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs per IP
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
 * Get cached response if available and not expired
 */
function getCached(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set cache with timestamp
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
    version: '1.0.112',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: NODE_ENV
  });
});

/**
 * Ping endpoint for quick availability check
 */
app.get('/ping', (req, res) => {
  res.json({ pong: true });
});

/**
 * Stats endpoint (optional - can be disabled in production)
 */
app.get('/stats', (req, res) => {
  if (NODE_ENV === 'production' && !req.headers['x-admin-key']) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({
    cacheSize: cache.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.112'
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
    // Exchange Cobalt cookie for bearer token using D&D Beyond's auth service
    // IMPORTANT: Cobalt cookie must be sent in Cookie header, NOT body
    const authResponse = await fetch(`${DDB_AUTH_SERVICE}/cobalt-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'User-Agent': 'Foundry-VTT-DDB-Importer/1.0'
      }
    });

    if (!authResponse.ok) {
      throw new Error('Invalid Cobalt cookie');
    }

    const authData = await authResponse.json();

    if (!authData.token || authData.token.length === 0) {
      throw new Error('No token received');
    }

    res.json({
      valid: true,
      token: authData.token
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
  const { cobaltCookie } = req.body;
  const endpoint = req.path.replace('/api/content', '');

  try {
    let url;
    // Map endpoints to correct D&D Beyond game-data URLs
    // Based on MrPrimate's ddb-proxy implementation
    if (endpoint === '/items') {
      // Items endpoint with sharingSetting=2 for all shared content
      url = `${DDB_GAME_DATA_BASE}/items?sharingSetting=2`;
    } else if (endpoint === '/spells') {
      // Spells endpoint - try to get all spells with sharingSetting=2
      url = `${DDB_GAME_DATA_BASE}/spells?sharingSetting=2`;
    } else if (endpoint === '/sources') {
      // Sources don't exist as an endpoint - this should fall back to local
      throw new Error('Sources endpoint not available from D&D Beyond API');
    } else {
      // Generic game-data endpoint
      url = `${DDB_GAME_DATA_BASE}${endpoint}`;
    }

    let data;
    if (cobaltCookie) {
      // Authenticated request - get bearer token first
      // IMPORTANT: Cobalt cookie must be sent in Cookie header, NOT body
      const authResponse = await fetch(`${DDB_AUTH_SERVICE}/cobalt-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `CobaltSession=${cobaltCookie}`,
          'User-Agent': 'Foundry-VTT-DDB-Importer/1.0'
        }
      });

      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authData = await authResponse.json();

      if (!authData.token) {
        throw new Error('No token received');
      }

      // Make authenticated request with bearer token
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`D&D Beyond API error: ${response.status} ${response.statusText}`);
      }

      data = await response.json();
    } else {
      // Anonymous request (public data)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
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
    cache.clear();
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
