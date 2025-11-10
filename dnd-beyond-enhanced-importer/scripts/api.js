// D&D Beyond Enhanced Importer
// API Interaction

/**
 * Class for handling D&D Beyond API interactions
 */
export class DnDBeyondEnhancedAPI {
  constructor() {
    this.baseUrl = 'https://character-service.dndbeyond.com/character/v5';
    this.contentUrl = 'https://www.dndbeyond.com/api';
    this.sourceCache = null;
    this.itemCache = null;
    this.spellCache = null;
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
   * Validate if a Cobalt cookie is valid and has access to D&D Beyond
   * @param {string} cookie - The Cobalt cookie to validate
   * @returns {Promise<boolean>} Whether the cookie is valid
   */
  async validateCookie(cookie) {
    try {
      // Test the cookie by trying to access user information
      const response = await this._makeRequest('/user-entity', cookie);
      
      // If we get a successful response, the cookie is valid
      return response && response.status === 200;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error validating cookie:', error);
      return false;
    }
  }
  
  /**
   * Make an authenticated request to the D&D Beyond API
   * @param {string} endpoint - The API endpoint to call
   * @param {string} [cookie=null] - Optional cookie to use (otherwise uses stored cookie)
   * @returns {Promise<Response>} The API response
   * @private
   */
  async _makeRequest(endpoint, cookie = null) {
    const cobaltCookie = cookie || this._getCobaltCookie();
    
    if (!cobaltCookie) {
      throw new Error('No Cobalt cookie available. Please configure your Cobalt cookie in the module settings.');
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response;
  }
  
  /**
   * Make a content request to the D&D Beyond content API
   * @param {string} endpoint - The content API endpoint
   * @param {string} [cookie=null] - Optional cookie to use
   * @returns {Promise<object>} The parsed response data
   * @private
   */
  async _makeContentRequest(endpoint, cookie = null) {
    const cobaltCookie = cookie || this._getCobaltCookie();
    
    if (!cobaltCookie) {
      throw new Error('No Cobalt cookie available. Please configure your Cobalt cookie in the module settings.');
    }
    
    const url = `${this.contentUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': `CobaltSession=${cobaltCookie}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`D&D Beyond API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  /**
   * Get user information including unlocked sources
   * @returns {Promise<object>} User information including unlocked sources
   */
  async getUserInfo() {
    const response = await this._makeRequest('/user-entity');
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  }
  
  /**
   * Get all available sources/books the user has access to
   * @returns {Promise<Array>} Array of source books
   */
  async getSources() {
    // Return cached sources if available
    if (this.sourceCache) {
      return this.sourceCache;
    }
    
    try {
      // Get user info which contains unlocked entitlements
      const userInfo = await this.getUserInfo();
      
      // Get all available sources from the content API
      const sourcesResponse = await this._makeContentRequest('/sources');
      
      if (!sourcesResponse || !sourcesResponse.data) {
        throw new Error('Failed to get sources from D&D Beyond');
      }
      
      // Filter sources based on user entitlements
      const entitledSources = sourcesResponse.data.filter(source => {
        // Check if the source is free
        if (source.isFree) return true;
        
        // Check if the user has unlocked this source
        const entitlementId = source.sourceId || source.id;
        return userInfo.entities.entitlements.some(e => 
          e.entityId === entitlementId && e.entity === 'source'
        );
      });
      
      // Cache the results
      this.sourceCache = entitledSources;
      
      return entitledSources;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error getting sources:', error);
      throw error;
    }
  }
  
  /**
   * Get all items from available sources
   * @returns {Promise<Array>} Array of items
   */
  async getItems() {
    // Return cached items if available
    if (this.itemCache) {
      return this.itemCache;
    }
    
    try {
      // Get the list of sources the user has access to
      const sources = await this.getSources();
      const sourceIds = sources.map(s => s.id);
      
      // Get items from the content API, filtering by available sources
      const itemsResponse = await this._makeContentRequest('/items');
      
      if (!itemsResponse || !itemsResponse.data) {
        throw new Error('Failed to get items from D&D Beyond');
      }
      
      // Filter items to only those from sources the user has access to
      const availableItems = itemsResponse.data.filter(item => {
        return sourceIds.includes(item.sourceId);
      });
      
      // Cache the results
      this.itemCache = availableItems;
      
      return availableItems;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error getting items:', error);
      throw error;
    }
  }
  
  /**
   * Get all spells from available sources
   * @returns {Promise<Array>} Array of spells
   */
  async getSpells() {
    // Return cached spells if available
    if (this.spellCache) {
      return this.spellCache;
    }
    
    try {
      // Get the list of sources the user has access to
      const sources = await this.getSources();
      const sourceIds = sources.map(s => s.id);
      
      // Get spells from the content API, filtering by available sources
      const spellsResponse = await this._makeContentRequest('/spells');
      
      if (!spellsResponse || !spellsResponse.data) {
        throw new Error('Failed to get spells from D&D Beyond');
      }
      
      // Filter spells to only those from sources the user has access to
      const availableSpells = spellsResponse.data.filter(spell => {
        return sourceIds.includes(spell.sourceId);
      });
      
      // Cache the results
      this.spellCache = availableSpells;
      
      return availableSpells;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error getting spells:', error);
      throw error;
    }
  }
  
  /**
   * Get detailed information about a specific item
   * @param {number} itemId - The D&D Beyond item ID
   * @returns {Promise<object>} Detailed item information
   */
  async getItemDetails(itemId) {
    try {
      const itemResponse = await this._makeContentRequest(`/item/${itemId}`);
      
      if (!itemResponse || !itemResponse.data) {
        throw new Error(`Failed to get item details for item ID ${itemId}`);
      }
      
      return itemResponse.data;
    } catch (error) {
      console.error(`D&D Beyond Enhanced Importer | Error getting item details for ${itemId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get detailed information about a specific spell
   * @param {number} spellId - The D&D Beyond spell ID
   * @returns {Promise<object>} Detailed spell information
   */
  async getSpellDetails(spellId) {
    try {
      const spellResponse = await this._makeContentRequest(`/spell/${spellId}`);
      
      if (!spellResponse || !spellResponse.data) {
        throw new Error(`Failed to get spell details for spell ID ${spellId}`);
      }
      
      return spellResponse.data;
    } catch (error) {
      console.error(`D&D Beyond Enhanced Importer | Error getting spell details for ${spellId}:`, error);
      throw error;
    }
  }
  
  /**
   * Clear all cached data
   */
  clearCache() {
    this.sourceCache = null;
    this.itemCache = null;
    this.spellCache = null;
  }
}
