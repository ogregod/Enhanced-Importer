// D&D Beyond Enhanced Importer
// Homebrew Importer

import { convertDDBItemToFoundry, convertDDBSpellToFoundry, createFolder } from './utilities.js';

/**
 * Class for handling the import of homebrew content from D&D Beyond
 */
export class HomebrewImporter {
  constructor(api) {
    this.api = api;
  }
  
  /**
   * Extract the homebrew ID from a D&D Beyond URL
   * @param {string} url - The homebrew URL
   * @returns {string|null} The homebrew ID or null if not found
   * @private
   */
  _extractHomebrewIdFromUrl(url) {
    // Handle different URL formats
    
    // Format: https://www.dndbeyond.com/homebrew/creations/####-name
    const creationMatch = url.match(/\/homebrew\/creations\/(\d+)/);
    if (creationMatch) return creationMatch[1];
    
    // Format: https://www.dndbeyond.com/subclasses/####-name
    const subclassMatch = url.match(/\/subclasses\/(\d+)/);
    if (subclassMatch) return subclassMatch[1];
    
    // Format: https://www.dndbeyond.com/spells/####-name
    const spellMatch = url.match(/\/spells\/(\d+)/);
    if (spellMatch) return spellMatch[1];
    
    // Format: https://www.dndbeyond.com/magic-items/####-name
    const itemMatch = url.match(/\/magic-items\/(\d+)/);
    if (itemMatch) return itemMatch[1];
    
    // No match found
    return null;
  }
  
  /**
   * Extract the content type from a D&D Beyond URL
   * @param {string} url - The homebrew URL
   * @returns {string} The content type ('item', 'spell', 'subclass', or 'unknown')
   * @private
   */
  _extractContentTypeFromUrl(url) {
    if (url.includes('/magic-items/')) return 'item';
    if (url.includes('/items/')) return 'item';
    if (url.includes('/spells/')) return 'spell';
    if (url.includes('/subclasses/')) return 'subclass';
    return 'unknown';
  }
  
  /**
   * Fetch homebrew content from D&D Beyond
   * @param {string} url - The homebrew content URL
   * @returns {Promise<object>} The homebrew content data
   */
  async fetchHomebrewByUrl(url) {
    try {
      // Extract the content type and ID
      const contentType = this._extractContentTypeFromUrl(url);
      const contentId = this._extractHomebrewIdFromUrl(url);
      
      if (!contentId) {
        throw new Error('Invalid homebrew URL. Could not extract content ID.');
      }
      
      let endpoint = '';
      
      // Build the appropriate endpoint
      switch (contentType) {
        case 'item':
          endpoint = `/homebrew/magic-items/${contentId}`;
          break;
        case 'spell':
          endpoint = `/homebrew/spells/${contentId}`;
          break;
        case 'subclass':
          endpoint = `/homebrew/subclasses/${contentId}`;
          break;
        default:
          throw new Error(`Unsupported content type: ${contentType}`);
      }
      
      // Fetch the content from the API
      const homebrewData = await this.api._makeContentRequest(endpoint);
      
      if (!homebrewData || !homebrewData.data) {
        throw new Error('Failed to fetch homebrew content from D&D Beyond');
      }
      
      return {
        contentType: contentType,
        data: homebrewData.data
      };
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error fetching homebrew:', error);
      throw error;
    }
  }
  
  /**
   * Import homebrew content from D&D Beyond
   * @param {string} url - The homebrew content URL
   * @param {object} options - Import options
   * @returns {Promise<object>} Import results
   */
  async importHomebrew(url, options) {
    try {
      // Fetch the homebrew content
      const homebrew = await this.fetchHomebrewByUrl(url);
      
      const results = {
        items: { success: 0, error: 0, skipped: 0 },
        spells: { success: 0, error: 0, skipped: 0 }
      };
      
      // Create folder if needed
      let folder = null;
      if (options.createFolders) {
        folder = await createFolder(options.folderName || 'D&D Beyond Homebrew', null, 'Item');
      }
      
      // Handle based on content type
      switch (homebrew.contentType) {
        case 'item':
          if (options.importItems) {
            await this._importHomebrewItem(homebrew.data, folder, options, results);
          }
          break;
        case 'spell':
          if (options.importSpells) {
            await this._importHomebrewSpell(homebrew.data, folder, options, results);
          }
          break;
        case 'subclass':
          // Subclasses not supported yet
          ui.notifications.warn('Subclass import is not supported yet');
          break;
      }
      
      return results;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error importing homebrew:', error);
      throw error;
    }
  }
  
  /**
   * Import a homebrew item
   * @param {object} itemData - The item data from D&D Beyond
   * @param {Folder|null} folder - The folder to import into
   * @param {object} options - Import options
   * @param {object} results - Results object to update
   * @private
   */
  async _importHomebrewItem(itemData, folder, options, results) {
    try {
      // Convert to Foundry format
      const foundryItem = await convertDDBItemToFoundry(itemData, [{ id: 0, name: 'Homebrew' }]);
      
      // Add homebrew flag
      if (!foundryItem.flags['dnd-beyond-enhanced-importer']) {
        foundryItem.flags['dnd-beyond-enhanced-importer'] = {};
      }
      foundryItem.flags['dnd-beyond-enhanced-importer'].isHomebrew = true;
      foundryItem.flags['dnd-beyond-enhanced-importer'].homebrewUrl = itemData.url || '';
      
      // Check if item already exists
      const existingItem = game.items.find(i => i.name === foundryItem.name && i.type === foundryItem.type);
      
      if (existingItem && !options.overwriteExisting) {
        results.items.skipped++;
        return;
      }
      
      // Create or update item
      if (existingItem && options.overwriteExisting) {
        await existingItem.update({
          ...foundryItem,
          folder: folder?.id
        });
      } else {
        await Item.create({
          ...foundryItem,
          folder: folder?.id
        });
      }
      
      results.items.success++;
    } catch (error) {
      console.error(`D&D Beyond Enhanced Importer | Error importing homebrew item:`, error);
      results.items.error++;
    }
  }
  
  /**
   * Import a homebrew spell
   * @param {object} spellData - The spell data from D&D Beyond
   * @param {Folder|null} folder - The folder to import into
   * @param {object} options - Import options
   * @param {object} results - Results object to update
   * @private
   */
  async _importHomebrewSpell(spellData, folder, options, results) {
    try {
      // Convert to Foundry format
      const foundrySpell = await convertDDBSpellToFoundry(spellData, [{ id: 0, name: 'Homebrew' }]);
      
      // Add homebrew flag
      if (!foundrySpell.flags['dnd-beyond-enhanced-importer']) {
        foundrySpell.flags['dnd-beyond-enhanced-importer'] = {};
      }
      foundrySpell.flags['dnd-beyond-enhanced-importer'].isHomebrew = true;
      foundrySpell.flags['dnd-beyond-enhanced-importer'].homebrewUrl = spellData.url || '';
      
      // Check if spell already exists
      const existingSpell = game.items.find(i => i.name === foundrySpell.name && i.type === 'spell');
      
      if (existingSpell && !options.overwriteExisting) {
        results.spells.skipped++;
        return;
      }
      
      // Create or update spell
      if (existingSpell && options.overwriteExisting) {
        await existingSpell.update({
          ...foundrySpell,
          folder: folder?.id
        });
      } else {
        await Item.create({
          ...foundrySpell,
          folder: folder?.id
        });
      }
      
      results.spells.success++;
    } catch (error) {
      console.error(`D&D Beyond Enhanced Importer | Error importing homebrew spell:`, error);
      results.spells.error++;
    }
  }
}