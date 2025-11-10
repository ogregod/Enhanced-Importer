#!/usr/bin/env node

/**
 * D&D Beyond Foundry Proxy Server
 *
 * This proxy server runs alongside Foundry VTT and handles API requests
 * to D&D Beyond, bypassing CORS restrictions that prevent direct browser access.
 *
 * Architecture:
 * Foundry Module (Browser) → This Proxy (localhost:3001) → D&D Beyond API
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// D&D Beyond API endpoints
const DDB_CHARACTER_SERVICE = 'https://character-service.dndbeyond.com/character/v5';
const DDB_CONTENT_API = 'https://www.dndbeyond.com/api';
const DDB_GAME_DATA_API = 'https://www.dndbeyond.com/api/game-data';

// Middleware
app.use(cors({
  origin: [
    'http://localhost:30000',
    'http://127.0.0.1:30000',
    /^http:\/\/localhost:\d+$/,  // Any localhost port
    /^http:\/\/127\.0\.0\.1:\d+$/  // Any 127.0.0.1 port
  ],
  credentials: true
}));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'D&D Beyond Proxy Server is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Proxy endpoint for D&D Beyond Character Service
 *
 * Route: POST /api/character/*
 * Body: { cobaltCookie: string, endpoint: string }
 */
app.post('/api/character/*', async (req, res) => {
  try {
    const { cobaltCookie } = req.body;
    const endpoint = req.path.replace('/api/character', '');

    if (!cobaltCookie) {
      return res.status(400).json({
        error: 'Missing cobaltCookie in request body'
      });
    }

    console.log(`Proxying to Character Service: ${endpoint}`);

    const response = await fetch(`${DDB_CHARACTER_SERVICE}${endpoint}`, {
      method: 'GET',
      headers: {
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'D&D Beyond API error',
        status: response.status,
        statusText: response.statusText,
        data: data
      });
    }

    res.json(data);

  } catch (error) {
    console.error('Character Service proxy error:', error);
    res.status(500).json({
      error: 'Proxy server error',
      message: error.message
    });
  }
});

/**
 * Proxy endpoint for D&D Beyond Content API
 *
 * Route: POST /api/content/*
 * Body: { cobaltCookie: string }
 */
app.post('/api/content/*', async (req, res) => {
  try {
    const { cobaltCookie } = req.body;
    const endpoint = req.path.replace('/api/content', '');

    console.log(`Proxying to Content API: ${endpoint}`);

    const headers = {
      'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Add cookie if provided
    if (cobaltCookie) {
      headers['Cookie'] = `CobaltSession=${cobaltCookie}`;
    }

    const response = await fetch(`${DDB_CONTENT_API}${endpoint}`, {
      method: 'GET',
      headers: headers
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'D&D Beyond API error',
        status: response.status,
        statusText: response.statusText,
        data: data
      });
    }

    res.json(data);

  } catch (error) {
    console.error('Content API proxy error:', error);
    res.status(500).json({
      error: 'Proxy server error',
      message: error.message
    });
  }
});

/**
 * Proxy endpoint for D&D Beyond Game Data API
 *
 * Route: POST /api/game-data/*
 * Body: { cobaltCookie: string }
 */
app.post('/api/game-data/*', async (req, res) => {
  try {
    const { cobaltCookie } = req.body;
    const endpoint = req.path.replace('/api/game-data', '');

    console.log(`Proxying to Game Data API: ${endpoint}`);

    const headers = {
      'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (cobaltCookie) {
      headers['Cookie'] = `CobaltSession=${cobaltCookie}`;
    }

    const response = await fetch(`${DDB_GAME_DATA_API}${endpoint}`, {
      method: 'GET',
      headers: headers
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'D&D Beyond API error',
        status: response.status,
        statusText: response.statusText,
        data: data
      });
    }

    res.json(data);

  } catch (error) {
    console.error('Game Data API proxy error:', error);
    res.status(500).json({
      error: 'Proxy server error',
      message: error.message
    });
  }
});

/**
 * Test endpoint to validate Cobalt cookie
 *
 * Route: POST /api/validate-cookie
 * Body: { cobaltCookie: string }
 */
app.post('/api/validate-cookie', async (req, res) => {
  try {
    const { cobaltCookie } = req.body;

    if (!cobaltCookie) {
      return res.status(400).json({
        valid: false,
        error: 'Missing cobaltCookie'
      });
    }

    // Try to fetch user entity to validate cookie
    const response = await fetch(`${DDB_CHARACTER_SERVICE}/user-entity`, {
      method: 'GET',
      headers: {
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        valid: true,
        username: data.username || 'Unknown',
        message: 'Cookie is valid'
      });
    } else {
      res.json({
        valid: false,
        status: response.status,
        message: 'Cookie is invalid or expired'
      });
    }

  } catch (error) {
    console.error('Cookie validation error:', error);
    res.status(500).json({
      valid: false,
      error: 'Validation failed',
      message: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.path} does not exist`,
    availableEndpoints: [
      'GET  /health',
      'POST /api/character/*',
      'POST /api/content/*',
      'POST /api/game-data/*',
      'POST /api/validate-cookie'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   D&D Beyond Foundry Proxy Server                   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Ready to proxy requests to D&D Beyond\n`);
  console.log('Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});
