// D&D Beyond Enhanced Importer - Server-Side Proxy
// This runs on Foundry's Node.js server, NOT in the browser

/**
 * Server-side proxy for D&D Beyond API requests
 * Handles CORS-blocked requests by making them server-side
 */

// Import Node.js https module for making requests
import https from 'https';

// Socket event handlers
Hooks.once('ready', () => {
  console.log('D&D Beyond Enhanced Importer | Server-side proxy initialized');

  // Listen for requests from clients
  game.socket.on('module.dnd-beyond-enhanced-importer', handleSocketRequest);
});

/**
 * Handle socket requests from clients
 * @param {object} data - The request data from client
 */
async function handleSocketRequest(data) {
  console.log('D&D Beyond Enhanced Importer | Server received request:', data.action);

  switch (data.action) {
    case 'fetchAPI':
      await handleAPIRequest(data);
      break;

    default:
      console.warn('D&D Beyond Enhanced Importer | Unknown action:', data.action);
  }
}

/**
 * Make an API request to D&D Beyond on behalf of the client
 * @param {object} data - Request data including endpoint, cookie, and requestId
 */
async function handleAPIRequest(data) {
  const { endpoint, cobaltCookie, requestId, userId, baseUrl } = data;

  // Validate inputs
  if (!endpoint || !cobaltCookie || !requestId || !userId) {
    console.error('D&D Beyond Enhanced Importer | Invalid API request data');
    return;
  }

  try {
    const url = baseUrl + endpoint;
    const response = await makeHTTPSRequest(url, cobaltCookie);

    // Send response back to the specific user who requested it
    game.socket.emit('module.dnd-beyond-enhanced-importer', {
      action: 'fetchAPIResponse',
      requestId: requestId,
      userId: userId,
      success: true,
      data: response
    });

  } catch (error) {
    console.error('D&D Beyond Enhanced Importer | Server API request failed:', error.message);

    // Send error back to client
    game.socket.emit('module.dnd-beyond-enhanced-importer', {
      action: 'fetchAPIResponse',
      requestId: requestId,
      userId: userId,
      success: false,
      error: error.message
    });
  }
}

/**
 * Make an HTTPS request using Node.js (no CORS restrictions!)
 * @param {string} url - The full URL to request
 * @param {string} cobaltCookie - The Cobalt session cookie
 * @returns {Promise<object>} The parsed JSON response
 */
function makeHTTPSRequest(url, cobaltCookie) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'User-Agent': 'Foundry-VTT-DDB-Importer/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      // Collect response data
      res.on('data', (chunk) => {
        body += chunk;
      });

      // Parse response when complete
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const data = JSON.parse(body);
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}
