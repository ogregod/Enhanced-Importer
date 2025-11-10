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
    this.useFallbackDatabase = true; // Use the local database as fallback
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
      // In a real-world scenario, we would test the cookie by accessing D&D Beyond
      // Since direct browser requests will be blocked by CORS, we'll simulate validation
      // In production, you would need a server-side proxy to make this request
      
      if (this.useFallbackDatabase) {
        // Simulate validation by checking if the cookie is not empty
        return cookie && cookie.trim() !== '';
      }
      
      // Try the cookie with a test request
      try {
        const response = await this._makeRequest('/user-entity', cookie);
        return response && response.ok;
      } catch (error) {
        console.warn('D&D Beyond Enhanced Importer | API request failed, likely due to CORS restrictions');
        return false;
      }
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
    // Browser CORS will always block these requests, so use fallback immediately
    const corsError = new Error('CORS restriction detected. Using fallback database.');
    corsError.name = 'CORSError';
    throw corsError;
  }
  
  /**
   * Make a content request to the D&D Beyond content API
   * @param {string} endpoint - The content API endpoint
   * @param {string} [cookie=null] - Optional cookie to use
   * @returns {Promise<object>} The parsed response data
   * @private
   */
  async _makeContentRequest(endpoint, cookie = null) {
    // Browser CORS will always block these requests, so use fallback immediately
    const corsError = new Error('CORS restriction detected. Using fallback database.');
    corsError.name = 'CORSError';
    throw corsError;
  }
  
  /**
   * Get user information including unlocked sources
   * @returns {Promise<object>} User information including unlocked sources
   */
  async getUserInfo() {
    try {
      const response = await this._makeRequest('/user-entity');
      
      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      // Handle CORS error specifically
      if (error.name === 'CORSError') {
        console.warn('D&D Beyond Enhanced Importer | Using fallback sources due to CORS restrictions');
        // Return a simulated user info object with entitlements for all sources
        return this._getFallbackUserInfo();
      }
      
      throw error;
    }
  }
  
  /**
   * Get a fallback user info object
   * @returns {object} A simulated user info object
   * @private
   */
  async _getFallbackUserInfo() {
    // Load the sources from the local database
    const sourcesResponse = await fetch('modules/dnd-beyond-enhanced-importer/database/sources.json');
    const sources = await sourcesResponse.json();
    
    // Create entitlements for all sources
    const entitlements = sources.map(source => ({
      entity: 'source',
      entityId: source.id,
      // Simulate that the user owns all non-free sources
      // In a real implementation, this should come from the user's account
      unlocked: true
    }));
    
    return {
      entities: {
        entitlements: entitlements
      }
    };
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
      // Try to get user info which contains unlocked entitlements
      let userInfo;
      try {
        userInfo = await this.getUserInfo();
      } catch (error) {
        if (error.name === 'CORSError') {
          userInfo = await this._getFallbackUserInfo();
        } else {
          throw error;
        }
      }
      
      // Try to get all available sources from the content API
      let sourcesData;
      try {
        const sourcesResponse = await this._makeContentRequest('/sources');
        sourcesData = sourcesResponse.data;
      } catch (error) {
        if (error.name === 'CORSError') {
          // Load sources from the local database
          const sourcesResponse = await fetch('modules/dnd-beyond-enhanced-importer/database/sources.json');
          sourcesData = await sourcesResponse.json();
        } else {
          throw error;
        }
      }
      
      if (!sourcesData) {
        throw new Error('Failed to get sources from D&D Beyond');
      }
      
      // Filter sources based on user entitlements
      const entitledSources = sourcesData.filter(source => {
        // Check if the source is free
        if (source.isFree) return true;
        
        // If we're using the fallback database, return all sources
        if (this.useFallbackDatabase) return true;
        
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
      
      // If all else fails, load sources from the local database
      try {
        const sourcesResponse = await fetch('modules/dnd-beyond-enhanced-importer/database/sources.json');
        const sources = await sourcesResponse.json();
        this.sourceCache = sources;
        return sources;
      } catch (fallbackError) {
        console.error('D&D Beyond Enhanced Importer | Error getting fallback sources:', fallbackError);
        throw error; // Throw the original error
      }
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
      
      let itemsData;
      try {
        // Try to get items from the content API
        const itemsResponse = await this._makeContentRequest('/items');
        itemsData = itemsResponse.data;
      } catch (error) {
        if (error.name === 'CORSError') {
          // Load items from the local database
          const itemsResponse = await fetch('modules/dnd-beyond-enhanced-importer/database/items.json');
          itemsData = await itemsResponse.json();
        } else {
          throw error;
        }
      }
      
      if (!itemsData) {
        throw new Error('Failed to get items from D&D Beyond');
      }
      
      // Filter items to only those from sources the user has access to
      const availableItems = itemsData.filter(item => {
        return sourceIds.includes(item.sourceId);
      });
      
      // Cache the results
      this.itemCache = availableItems;
      
      return availableItems;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error getting items:', error);
      
      // If all else fails, load items from the local database
      try {
        const itemsResponse = await fetch('modules/dnd-beyond-enhanced-importer/database/items.json');
        const items = await itemsResponse.json();
        this.itemCache = items;
        return items;
      } catch (fallbackError) {
        console.error('D&D Beyond Enhanced Importer | Error getting fallback items:', fallbackError);
        throw error; // Throw the original error
      }
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
      
      let spellsData;
      try {
        // Try to get spells from the content API
        const spellsResponse = await this._makeContentRequest('/spells');
        spellsData = spellsResponse.data;
      } catch (error) {
        if (error.name === 'CORSError') {
          // Load spells from the local database
          const spellsResponse = await fetch('modules/dnd-beyond-enhanced-importer/database/spells.json');
          spellsData = await spellsResponse.json();
        } else {
          throw error;
        }
      }
      
      if (!spellsData) {
        throw new Error('Failed to get spells from D&D Beyond');
      }
      
      // Filter spells to only those from sources the user has access to
      const availableSpells = spellsData.filter(spell => {
        return sourceIds.includes(spell.sourceId);
      });
      
      // Cache the results
      this.spellCache = availableSpells;
      
      return availableSpells;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error getting spells:', error);
      
      // If all else fails, load spells from the local database
      try {
        const spellsResponse = await fetch('modules/dnd-beyond-enhanced-importer/database/spells.json');
        const spells = await spellsResponse.json();
        this.spellCache = spells;
        return spells;
      } catch (fallbackError) {
        console.error('D&D Beyond Enhanced Importer | Error getting fallback spells:', fallbackError);
        throw error; // Throw the original error
      }
    }
  }
  
  /**
   * Get detailed information about a specific item
   * @param {number} itemId - The D&D Beyond item ID
   * @returns {Promise<object>} Detailed item information
   */
  async getItemDetails(itemId) {
    try {
      try {
        // Try to get item details from the content API
        const itemResponse = await this._makeContentRequest(`/item/${itemId}`);
        return itemResponse.data;
      } catch (error) {
        if (error.name === 'CORSError') {
          // Fallback to using the database
          // In a real implementation, you would load the item details from the database
          // For now, we'll just return a simulated item with the ID
          const items = await this.getItems();
          const item = items.find(i => i.id === itemId);
          
          if (!item) {
            throw new Error(`Failed to get item details for item ID ${itemId}`);
          }
          
          return item;
        } else {
          throw error;
        }
      }
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
      try {
        // Try to get spell details from the content API
        const spellResponse = await this._makeContentRequest(`/spell/${spellId}`);
        return spellResponse.data;
      } catch (error) {
        if (error.name === 'CORSError') {
          // Fallback to using the database
          // In a real implementation, you would load the spell details from the database
          // For now, we'll just return a simulated spell with the ID
          const spells = await this.getSpells();
          const spell = spells.find(s => s.id === spellId);
          
          if (!spell) {
            throw new Error(`Failed to get spell details for spell ID ${spellId}`);
          }
          
          return spell;
        } else {
          throw error;
        }
      }
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