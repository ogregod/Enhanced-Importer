// D&D Beyond Enhanced Importer
// API Interaction with Proxy Support

/**
 * Class for handling D&D Beyond API interactions via proxy server
 */
export class DnDBeyondEnhancedAPI {
  constructor() {
    this.proxyAvailable = null; // null = not checked, true/false = result
    this.sourceCache = null;
    this.itemCache = null;
    this.spellCache = null;
  }

  /**
   * Get the proxy URL from settings
   * @returns {string} The proxy URL
   * @private
   */
  _getProxyUrl() {
    const url = game.settings.get('dnd-beyond-enhanced-importer', 'proxyUrl');
    return url || 'https://enhanced-importer.onrender.com'; // Fallback to hosted proxy
  }

  /**
   * Get the Cobalt cookie from settings
   * @returns {string} The Cobalt cookie
   * @private
   */
  _getCobaltCookie() {
    return game.settings.get('dnd-beyond-enhanced-importer', 'cobaltCookie');
  }

  /**
   * Check if the proxy server is running and available
   * @returns {Promise<boolean>} Whether the proxy is available
   */
  async checkProxyAvailability() {
    // Return cached result if already checked
    if (this.proxyAvailable !== null) {
      return this.proxyAvailable;
    }

    try {
      const response = await fetch(`${this._getProxyUrl()}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        this.proxyAvailable = data.status === 'ok';
        console.log('D&D Beyond Enhanced Importer | Proxy server is available');
        return this.proxyAvailable;
      }
    } catch (error) {
      this.proxyAvailable = false;
      console.warn('D&D Beyond Enhanced Importer | Proxy server not available, using local database');
    }

    return this.proxyAvailable;
  }

  /**
   * Validate if a Cobalt cookie is valid
   * @param {string} cookie - The Cobalt cookie to validate
   * @returns {Promise<boolean>} Whether the cookie is valid
   */
  async validateCookie(cookie) {
    if (!cookie || cookie.trim() === '') {
      return false;
    }

    // Check if proxy is available
    const proxyAvailable = await this.checkProxyAvailability();

    if (!proxyAvailable) {
      // Can't validate without proxy, assume valid if non-empty
      console.warn('D&D Beyond Enhanced Importer | Cannot validate cookie without proxy server');
      return true;
    }

    try {
      const response = await fetch(`${this._getProxyUrl()}/api/validate-cookie`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cobaltCookie: cookie })
      });

      if (response.ok) {
        const data = await response.json();
        return data.valid;
      }

      return false;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error validating cookie:', error);
      return false;
    }
  }

  /**
   * Make a request to the proxy server for D&D Beyond character service
   * @param {string} endpoint - The API endpoint
   * @param {string} [cookie=null] - Optional cookie to use
   * @returns {Promise<object>} The API response data
   * @private
   */
  async _makeProxyRequest(endpoint, cookie = null) {
    const cobaltCookie = cookie || this._getCobaltCookie();

    if (!cobaltCookie) {
      throw new Error('No Cobalt cookie available');
    }

    const response = await fetch(`${this._getProxyUrl()}/api/character${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cobaltCookie })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Proxy request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Make a content request via proxy
   * @param {string} endpoint - The content API endpoint
   * @param {string} [cookie=null] - Optional cookie to use
   * @returns {Promise<object>} The API response data
   * @private
   */
  async _makeContentProxyRequest(endpoint, cookie = null) {
    const cobaltCookie = cookie || this._getCobaltCookie();

    const response = await fetch(`${this._getProxyUrl()}/api/content${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cobaltCookie })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Proxy request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get user information including unlocked sources
   * @returns {Promise<object>} User information
   */
  async getUserInfo() {
    const proxyAvailable = await this.checkProxyAvailability();

    if (!proxyAvailable) {
      throw new Error('Proxy server not available');
    }

    try {
      return await this._makeProxyRequest('/user-entity');
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error getting user info:', error);
      throw error;
    }
  }

  /**
   * Get sources (sourcebooks) from D&D Beyond
   * @returns {Promise<Array>} Array of sources
   */
  async getSources() {
    // Return cached sources if available
    if (this.sourceCache) {
      return this.sourceCache;
    }

    const proxyAvailable = await this.checkProxyAvailability();

    if (!proxyAvailable) {
      // Fall back to local database
      console.log('D&D Beyond Enhanced Importer | Loading sources from local database');
      const response = await fetch('modules/dnd-beyond-enhanced-importer/database/sources.json');
      this.sourceCache = await response.json();
      return this.sourceCache;
    }

    try {
      // Try to get sources from D&D Beyond via proxy
      const data = await this._makeContentProxyRequest('/sources');
      this.sourceCache = data;
      return data;
    } catch (error) {
      console.warn('D&D Beyond Enhanced Importer | API failed, using local database:', error.message);

      // Fall back to local database
      const response = await fetch('modules/dnd-beyond-enhanced-importer/database/sources.json');
      this.sourceCache = await response.json();
      return this.sourceCache;
    }
  }

  /**
   * Get items from D&D Beyond
   * @returns {Promise<Array>} Array of items
   */
  async getItems() {
    // Return cached items if available
    if (this.itemCache) {
      return this.itemCache;
    }

    const proxyAvailable = await this.checkProxyAvailability();

    if (!proxyAvailable) {
      // Fall back to local database
      console.log('D&D Beyond Enhanced Importer | Loading items from local database');
      const response = await fetch('modules/dnd-beyond-enhanced-importer/database/items.json');
      this.itemCache = await response.json();
      return this.itemCache;
    }

    try {
      // Try to get items from D&D Beyond via proxy
      const userInfo = await this.getUserInfo();
      const items = await this._makeContentProxyRequest('/items');

      // Filter items based on user's owned sources
      const ownedSourceIds = userInfo.sources || [];
      const filteredItems = items.filter(item =>
        ownedSourceIds.includes(item.sourceId) || item.isHomebrew
      );

      this.itemCache = filteredItems;
      return filteredItems;
    } catch (error) {
      console.warn('D&D Beyond Enhanced Importer | API failed, using local database:', error.message);

      // Fall back to local database
      const response = await fetch('modules/dnd-beyond-enhanced-importer/database/items.json');
      this.itemCache = await response.json();
      return this.itemCache;
    }
  }

  /**
   * Get spells from D&D Beyond
   * @returns {Promise<Array>} Array of spells
   */
  async getSpells() {
    // Return cached spells if available
    if (this.spellCache) {
      return this.spellCache;
    }

    const proxyAvailable = await this.checkProxyAvailability();

    if (!proxyAvailable) {
      // Fall back to local database
      console.log('D&D Beyond Enhanced Importer | Loading spells from local database');
      const response = await fetch('modules/dnd-beyond-enhanced-importer/database/spells.json');
      this.spellCache = await response.json();
      return this.spellCache;
    }

    try {
      // Try to get spells from D&D Beyond via proxy
      const userInfo = await this.getUserInfo();
      const spells = await this._makeContentProxyRequest('/spells');

      // Filter spells based on user's owned sources
      const ownedSourceIds = userInfo.sources || [];
      const filteredSpells = spells.filter(spell =>
        ownedSourceIds.includes(spell.sourceId) || spell.isHomebrew
      );

      this.spellCache = filteredSpells;
      return filteredSpells;
    } catch (error) {
      console.warn('D&D Beyond Enhanced Importer | API failed, using local database:', error.message);

      // Fall back to local database
      const response = await fetch('modules/dnd-beyond-enhanced-importer/database/spells.json');
      this.spellCache = await response.json();
      return this.spellCache;
    }
  }

  /**
   * Get details for a specific item
   * @param {number} itemId - The item ID
   * @returns {Promise<object>} Item details
   */
  async getItemDetails(itemId) {
    const proxyAvailable = await this.checkProxyAvailability();

    if (!proxyAvailable) {
      throw new Error('Proxy server required for item details');
    }

    return await this._makeContentProxyRequest(`/items/${itemId}`);
  }

  /**
   * Get details for a specific spell
   * @param {number} spellId - The spell ID
   * @returns {Promise<object>} Spell details
   */
  async getSpellDetails(spellId) {
    const proxyAvailable = await this.checkProxyAvailability();

    if (!proxyAvailable) {
      throw new Error('Proxy server required for spell details');
    }

    return await this._makeContentProxyRequest(`/spells/${spellId}`);
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.sourceCache = null;
    this.itemCache = null;
    this.spellCache = null;
    console.log('D&D Beyond Enhanced Importer | Caches cleared');
  }
}
