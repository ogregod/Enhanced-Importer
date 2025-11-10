// D&D Beyond Enhanced Importer
// Importer Implementation

import { DnDBeyondEnhancedAPI } from './api.js';
import { ImportDialog } from './dialog.js';
import { 
  convertDDBItemToFoundry, 
  convertDDBSpellToFoundry,
  createFolder,
  getSourceName
} from './utilities.js';

/**
 * Class for handling the import process
 */
export class EnhancedImporter {
  constructor() {
    this.api = new DnDBeyondEnhancedAPI();
    this.importInProgress = false;
  }
  
  /**
   * Show the import dialog
   */
  showImportDialog() {
    // Only GMs can import
    if (!game.user.isGM) {
      ui.notifications.error('Only Game Masters can import content.');
      return;
    }
    
    // Check if we have a valid Cobalt cookie
    const cobaltCookie = game.settings.get('dnd-beyond-enhanced-importer', 'cobaltCookie');
    if (!cobaltCookie) {
      this._showCobaltSetupDialog();
      return;
    }
    
    // Show the import dialog
    new ImportDialog(this).render(true);
  }
  
  /**
   * Show the Cobalt cookie setup dialog
   * @private
   */
  _showCobaltSetupDialog() {
    const content = `
      <p>To import content from D&D Beyond, you need to provide your Cobalt cookie. This is used to authenticate with D&D Beyond and access your purchased content.</p>
      <p><strong>How to get your Cobalt Cookie:</strong></p>
      <ol>
        <li>Log in to <a href="https://www.dndbeyond.com" target="_blank">D&D Beyond</a>.</li>
        <li>Open your browser's Developer Tools (F12 or Ctrl+Shift+I).</li>
        <li>Go to the Application or Storage tab.</li>
        <li>Find "Cookies" in the sidebar and select "https://www.dndbeyond.com".</li>
        <li>Look for a cookie named "CobaltSession" and copy its value.</li>
      </ol>
      <div class="form-group">
        <label for="cobalt-cookie">Cobalt Cookie:</label>
        <input type="text" id="cobalt-cookie" name="cobaltCookie" placeholder="Paste your Cobalt cookie here">
      </div>
      <p class="notes"><strong>Note:</strong> Your Cobalt cookie is only stored locally on your Foundry server and is used solely for API authentication with D&D Beyond. It is never shared with anyone else.</p>
      <p class="notes"><strong>Note:</strong> Due to browser security restrictions (CORS), direct API access may be limited. This module will use its local database for imports.</p>
    `;
    
    new Dialog({
      title: 'D&D Beyond Enhanced Importer - Cobalt Cookie Setup',
      content: content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: 'Save Cookie',
          callback: async (html) => {
            const cookie = html.find('#cobalt-cookie').val();
            if (!cookie) {
              ui.notifications.error('Please enter a Cobalt cookie.');
              return;
            }
            
            // Validate the cookie
            try {
              ui.notifications.info('Validating Cobalt cookie...');
              const valid = await this.api.validateCookie(cookie);
              
              if (valid) {
                await game.settings.set('dnd-beyond-enhanced-importer', 'cobaltCookie', cookie);
                ui.notifications.info('Cobalt cookie saved successfully.');
                
                // Show the import dialog after setting the cookie
                this.showImportDialog();
              } else {
                ui.notifications.error('Invalid Cobalt cookie. Please check and try again.');
              }
            } catch (error) {
              console.error('D&D Beyond Enhanced Importer | Error validating cookie:', error);
              ui.notifications.error('Error validating Cobalt cookie. Please check the console for details.');
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'save',
      width: 500
    }).render(true);
  }
  
  /**
   * Fetch sources from D&D Beyond
   * @returns {Promise<Array>} Array of sources
   */
  async fetchSources() {
    try {
      ui.notifications.info('Fetching sources from D&D Beyond...');
      
      let sources = [];
      try {
        sources = await this.api.getSources();
      } catch (error) {
        console.error('D&D Beyond Enhanced Importer | Error fetching sources from API:', error);
        
        // If API fails, try loading from the local database
        ui.notifications.warn('Could not connect to D&D Beyond API. Using local database.');
        const response = await fetch('modules/dnd-beyond-enhanced-importer/database/sources.json');
        sources = await response.json();
      }
      
      // Sort by name
      sources.sort((a, b) => a.name.localeCompare(b.name));
      
      return sources;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error fetching sources:', error);
      ui.notifications.error('Error fetching sources. Check the console for details.');
      return [];
    }
  }
  
  /**
   * Import content from selected sources
   * @param {Array} selectedSources - Array of source IDs to import
   * @param {object} options - Import options
   * @returns {Promise<object>} Import results
   */
  async importContent(selectedSources, options) {
    if (this.importInProgress) {
      ui.notifications.error('An import is already in progress.');
      return;
    }
    
    this.importInProgress = true;
    
    try {
      const results = {
        items: {
          success: 0,
          error: 0,
          skipped: 0
        },
        spells: {
          success: 0,
          error: 0,
          skipped: 0
        }
      };
      
      // Get all sources for mapping names
      let sources = [];
      try {
        sources = await this.api.getSources();
      } catch (error) {
        console.error('D&D Beyond Enhanced Importer | Error fetching sources from API:', error);
        
        // If API fails, try loading from the local database
        const response = await fetch('modules/dnd-beyond-enhanced-importer/database/sources.json');
        sources = await response.json();
      }
      
      // Create folders if needed
      const folders = {};
      if (options.createFolders) {
        // Create a parent folder for imported content
        folders.parent = await createFolder('D&D Beyond', null, 'Item');
        
        if (options.folderStructure === 'sourceBook') {
          // Create a folder for each source
          for (const sourceId of selectedSources) {
            const source = sources.find(s => s.id === sourceId);
            if (source) {
              folders[sourceId] = await createFolder(source.name, folders.parent.id, 'Item');
            }
          }
        } else if (options.folderStructure === 'itemType') {
          // Create folders for each item type
          folders.weapons = await createFolder('Weapons', folders.parent.id, 'Item');
          folders.armor = await createFolder('Armor', folders.parent.id, 'Item');
          folders.equipment = await createFolder('Equipment', folders.parent.id, 'Item');
          folders.consumables = await createFolder('Consumables', folders.parent.id, 'Item');
          folders.tools = await createFolder('Tools', folders.parent.id, 'Item');
          folders.containers = await createFolder('Containers', folders.parent.id, 'Item');
          folders.loot = await createFolder('Loot', folders.parent.id, 'Item');
        }
        
        // Create a folder for spells
        folders.spellsParent = await createFolder('D&D Beyond', null, 'Item');
        if (options.folderStructure === 'sourceBook') {
          // Create a folder for each source
          for (const sourceId of selectedSources) {
            const source = sources.find(s => s.id === sourceId);
            if (source) {
              folders[`spells-${sourceId}`] = await createFolder(source.name, folders.spellsParent.id, 'Item');
            }
          }
        } else if (options.folderStructure === 'itemType') {
          // Create folders for spell levels
          for (let level = 0; level <= 9; level++) {
            const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;
            folders[`level-${level}`] = await createFolder(levelName, folders.spellsParent.id, 'Item');
          }
        }
      }
      
      // Start with items if selected
      if (options.importItems) {
        ui.notifications.info('Fetching items from D&D Beyond...');
        
        let items = [];
        try {
          items = await this.api.getItems();
        } catch (error) {
          console.error('D&D Beyond Enhanced Importer | Error fetching items from API:', error);
          
          // If API fails, try loading from the local database
          ui.notifications.warn('Could not connect to D&D Beyond API. Using local database.');
          const response = await fetch('modules/dnd-beyond-enhanced-importer/database/items.json');
          items = await response.json();
        }
        
        // Filter to only selected sources
        const filteredItems = items.filter(item => selectedSources.includes(item.sourceId));
        
        // Create a progress bar
        const itemProgress = new Progress({
          label: 'Importing Items',
          pct: 0,
          step: 0,
          total: filteredItems.length,
          animate: false
        });
        
        // Import each item
        for (let i = 0; i < filteredItems.length; i++) {
          const ddbItem = filteredItems[i];
          
          try {
            // Update progress
            itemProgress.label = `Importing Item: ${ddbItem.name}`;
            itemProgress.pct = Math.round((i / filteredItems.length) * 100);
            itemProgress.step = i;
            itemProgress.render();
            
            // Get detailed item information
            let itemDetails;
            try {
              itemDetails = await this.api.getItemDetails(ddbItem.id);
            } catch (error) {
              console.warn(`D&D Beyond Enhanced Importer | Error getting item details for ${ddbItem.name}, using basic item:`, error);
              itemDetails = ddbItem;
            }
            
            // Convert to Foundry format
            const foundryItem = await convertDDBItemToFoundry(itemDetails, sources);
            
            // Determine folder
            let folderId = null;
            if (options.createFolders) {
              if (options.folderStructure === 'sourceBook') {
                folderId = folders[ddbItem.sourceId]?.id;
              } else if (options.folderStructure === 'itemType') {
                // Map DDB item type to folder
                switch (foundryItem.type) {
                  case 'weapon': folderId = folders.weapons?.id; break;
                  case 'equipment': 
                    if (foundryItem.system.armor?.type) {
                      folderId = folders.armor?.id;
                    } else {
                      folderId = folders.equipment?.id;
                    }
                    break;
                  case 'consumable': folderId = folders.consumables?.id; break;
                  case 'tool': folderId = folders.tools?.id; break;
                  case 'container': folderId = folders.containers?.id; break;
                  case 'loot': folderId = folders.loot?.id; break;
                  default: folderId = folders.parent?.id;
                }
              } else {
                folderId = folders.parent?.id;
              }
            }
            
            // Check if item already exists
            const existingItem = game.items.find(i => 
              i.name === foundryItem.name && i.type === foundryItem.type
            );
            
            if (existingItem && !options.overwriteExisting) {
              // Skip this item
              results.items.skipped++;
              continue;
            }
            
            // Create or update the item
            if (existingItem && options.overwriteExisting) {
              // Update existing item
              await existingItem.update({
                ...foundryItem,
                folder: folderId
              });
            } else {
              // Create new item
              await Item.create({
                ...foundryItem,
                folder: folderId
              });
            }
            
            results.items.success++;
          } catch (error) {
            console.error(`D&D Beyond Enhanced Importer | Error importing item ${ddbItem.name}:`, error);
            results.items.error++;
          }
        }
        
        // Close the progress bar
        itemProgress.close();
      }
      
      // Import spells if selected
      if (options.importSpells) {
        ui.notifications.info('Fetching spells from D&D Beyond...');
        
        let spells = [];
        try {
          spells = await this.api.getSpells();
        } catch (error) {
          console.error('D&D Beyond Enhanced Importer | Error fetching spells from API:', error);
          
          // If API fails, try loading from the local database
          ui.notifications.warn('Could not connect to D&D Beyond API. Using local database.');
          const response = await fetch('modules/dnd-beyond-enhanced-importer/database/spells.json');
          spells = await response.json();
        }
        
        // Filter to only selected sources
        const filteredSpells = spells.filter(spell => selectedSources.includes(spell.sourceId));
        
        // Create a progress bar
        const spellProgress = new Progress({
          label: 'Importing Spells',
          pct: 0,
          step: 0,
          total: filteredSpells.length,
          animate: false
        });
        
        // Import each spell
        for (let i = 0; i < filteredSpells.length; i++) {
          const ddbSpell = filteredSpells[i];
          
          try {
            // Update progress
            spellProgress.label = `Importing Spell: ${ddbSpell.name}`;
            spellProgress.pct = Math.round((i / filteredSpells.length) * 100);
            spellProgress.step = i;
            spellProgress.render();
            
            // Get detailed spell information
            let spellDetails;
            try {
              spellDetails = await this.api.getSpellDetails(ddbSpell.id);
            } catch (error) {
              console.warn(`D&D Beyond Enhanced Importer | Error getting spell details for ${ddbSpell.name}, using basic spell:`, error);
              spellDetails = ddbSpell;
            }
            
            // Convert to Foundry format
            const foundrySpell = await convertDDBSpellToFoundry(spellDetails, sources);
            
            // Determine folder
            let folderId = null;
            if (options.createFolders) {
              if (options.folderStructure === 'sourceBook') {
                folderId = folders[`spells-${ddbSpell.sourceId}`]?.id;
              } else if (options.folderStructure === 'itemType') {
                folderId = folders[`level-${spellDetails.level}`]?.id;
              } else {
                folderId = folders.spellsParent?.id;
              }
            }
            
            // Check if spell already exists
            const existingSpell = game.items.find(i => 
              i.name === foundrySpell.name && i.type === 'spell'
            );
            
            if (existingSpell && !options.overwriteExisting) {
              // Skip this spell
              results.spells.skipped++;
              continue;
            }
            
            // Create or update the spell
            if (existingSpell && options.overwriteExisting) {
              // Update existing spell
              await existingSpell.update({
                ...foundrySpell,
                folder: folderId
              });
            } else {
              // Create new spell
              await Item.create({
                ...foundrySpell,
                folder: folderId
              });
            }
            
            results.spells.success++;
          } catch (error) {
            console.error(`D&D Beyond Enhanced Importer | Error importing spell ${ddbSpell.name}:`, error);
            results.spells.error++;
          }
        }
        
        // Close the progress bar
        spellProgress.close();
      }
      
      // Update the last sync date
      await game.settings.set('dnd-beyond-enhanced-importer', 'lastSync', new Date().toISOString());
      
      return results;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error importing content:', error);
      ui.notifications.error('Error importing content. Check the console for details.');
      throw error;
    } finally {
      this.importInProgress = false;
    }
  }
  
  /**
   * Check if an item or spell should be imported
   * @param {object} item - The item or spell
   * @param {Array} selectedSources - Array of selected source IDs
   * @returns {boolean} Whether the item should be imported
   */
  shouldImport(item, selectedSources) {
    return selectedSources.includes(item.sourceId);
  }
}

/**
 * Progress bar class for showing import progress
 */
class Progress extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options) {
    super(options);
    this.pct = options.pct || 0;
    this.label = options.label || 'Progress';
    this.step = options.step || 0;
    this.total = options.total || 0;
    this.animate = options.animate !== undefined ? options.animate : true;
  }
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'ddb-import-progress',
      template: 'modules/dnd-beyond-enhanced-importer/templates/progress.html',
      title: 'Importing...',
      width: 400
    });
  }
  
  getData() {
    return {
      pct: this.pct,
      label: this.label,
      step: this.step,
      total: this.total,
      animate: this.animate
    };
  }
  
  updateProgress(label, pct, step) {
    this.label = label || this.label;
    this.pct = pct || this.pct;
    this.step = step || this.step;
    this.render(true);
  }
}