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
    console.log('D&D Beyond Enhanced Importer | DEBUG: importContent called');
    console.log('D&D Beyond Enhanced Importer | DEBUG: Selected sources:', selectedSources);
    console.log('D&D Beyond Enhanced Importer | DEBUG: Options:', options);

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
        console.log('D&D Beyond Enhanced Importer | DEBUG: Starting item import');
        ui.notifications.info('Fetching items from D&D Beyond...');

        let items = [];
        try {
          items = await this.api.getItems();
          console.log(`D&D Beyond Enhanced Importer | DEBUG: Retrieved ${items.length} total items`);
        } catch (error) {
          console.error('D&D Beyond Enhanced Importer | Error fetching items from API:', error);

          // If API fails, try loading from the local database
          ui.notifications.warn('Could not connect to D&D Beyond API. Using local database.');
          const response = await fetch('modules/dnd-beyond-enhanced-importer/database/items.json');
          items = await response.json();
          console.log(`D&D Beyond Enhanced Importer | DEBUG: Retrieved ${items.length} items from fallback`);
        }

        // Filter to only selected sources
        // D&D Beyond API returns sources as an array, not a single sourceId
        const filteredItems = items.filter(item => {
          // Check if item has sources array (API format)
          if (item.sources && Array.isArray(item.sources)) {
            return item.sources.some(source => selectedSources.includes(source.sourceId));
          }
          // Fallback to sourceId property (local database format)
          return selectedSources.includes(item.sourceId);
        });
        console.log(`D&D Beyond Enhanced Importer | DEBUG: Filtered to ${filteredItems.length} items matching selected sources`);

        if (filteredItems.length === 0) {
          console.warn('D&D Beyond Enhanced Importer | DEBUG: No items match selected sources!');
          console.log('D&D Beyond Enhanced Importer | DEBUG: Sample item sources:', items.slice(0, 5).map(i => ({ name: i.name, sources: i.sources })));
        }
        
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
          console.log(`D&D Beyond Enhanced Importer | DEBUG: Processing item ${i + 1}/${filteredItems.length}: ${ddbItem.name}`);

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
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Got detailed info for ${ddbItem.name}`);
            } catch (error) {
              console.warn(`D&D Beyond Enhanced Importer | Error getting item details for ${ddbItem.name}, using basic item:`, error);
              itemDetails = ddbItem;
            }

            // Convert to Foundry format
            console.log(`D&D Beyond Enhanced Importer | DEBUG: Converting ${ddbItem.name} to Foundry format`);
            const foundryItem = await convertDDBItemToFoundry(itemDetails, sources);
            console.log(`D&D Beyond Enhanced Importer | DEBUG: Converted item:`, foundryItem);
            
            // Determine folder
            let folderId = null;
            if (options.createFolders) {
              if (options.folderStructure === 'sourceBook') {
                // Get the first source from the sources array (API format) or use sourceId (local format)
                const sourceId = ddbItem.sources?.[0]?.sourceId || ddbItem.sourceId;
                folderId = folders[sourceId]?.id;
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
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Skipping ${ddbItem.name} - already exists`);
              results.items.skipped++;
              continue;
            }

            // Create or update the item
            if (existingItem && options.overwriteExisting) {
              // Update existing item
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Updating existing item ${ddbItem.name}`);
              await existingItem.update({
                ...foundryItem,
                folder: folderId
              });
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Successfully updated ${ddbItem.name}`);
            } else {
              // Create new item
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Creating new item ${ddbItem.name}`);
              const createdItem = await Item.create({
                ...foundryItem,
                folder: folderId
              });
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Successfully created ${ddbItem.name}:`, createdItem);
            }

            results.items.success++;
          } catch (error) {
            console.error(`D&D Beyond Enhanced Importer | Error importing item ${ddbItem.name}:`, error);
            console.error(`D&D Beyond Enhanced Importer | DEBUG: Error stack:`, error.stack);
            results.items.error++;
          }
        }
        
        // Close the progress bar
        itemProgress.close();
      }
      
      // Import spells if selected
      if (options.importSpells) {
        console.log('D&D Beyond Enhanced Importer | DEBUG: Starting spell import');
        ui.notifications.info('Fetching spells from D&D Beyond...');

        let spells = [];
        try {
          spells = await this.api.getSpells();
          console.log(`D&D Beyond Enhanced Importer | DEBUG: Retrieved ${spells.length} total spells`);
        } catch (error) {
          console.error('D&D Beyond Enhanced Importer | Error fetching spells from API:', error);

          // If API fails, try loading from the local database
          ui.notifications.warn('Could not connect to D&D Beyond API. Using local database.');
          const response = await fetch('modules/dnd-beyond-enhanced-importer/database/spells.json');
          spells = await response.json();
          console.log(`D&D Beyond Enhanced Importer | DEBUG: Retrieved ${spells.length} spells from fallback`);
        }

        // Filter to only selected sources
        // D&D Beyond API returns sources as an array, not a single sourceId
        const filteredSpells = spells.filter(spell => {
          // Check if spell has sources array (API format)
          if (spell.sources && Array.isArray(spell.sources)) {
            return spell.sources.some(source => selectedSources.includes(source.sourceId));
          }
          // Fallback to sourceId property (local database format)
          return selectedSources.includes(spell.sourceId);
        });
        console.log(`D&D Beyond Enhanced Importer | DEBUG: Filtered to ${filteredSpells.length} spells matching selected sources`);

        if (filteredSpells.length === 0) {
          console.warn('D&D Beyond Enhanced Importer | DEBUG: No spells match selected sources!');
          console.log('D&D Beyond Enhanced Importer | DEBUG: Sample spell sources:', spells.slice(0, 5).map(s => ({ name: s.name, sources: s.sources })));
        }
        
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
          console.log(`D&D Beyond Enhanced Importer | DEBUG: Processing spell ${i + 1}/${filteredSpells.length}: ${ddbSpell.name}`);

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
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Got detailed info for ${ddbSpell.name}`);
            } catch (error) {
              console.warn(`D&D Beyond Enhanced Importer | Error getting spell details for ${ddbSpell.name}, using basic spell:`, error);
              spellDetails = ddbSpell;
            }

            // Convert to Foundry format
            console.log(`D&D Beyond Enhanced Importer | DEBUG: Converting ${ddbSpell.name} to Foundry format`);
            const foundrySpell = await convertDDBSpellToFoundry(spellDetails, sources);
            console.log(`D&D Beyond Enhanced Importer | DEBUG: Converted spell:`, foundrySpell);
            
            // Determine folder
            let folderId = null;
            if (options.createFolders) {
              if (options.folderStructure === 'sourceBook') {
                // Get the first source from the sources array (API format) or use sourceId (local format)
                const sourceId = ddbSpell.sources?.[0]?.sourceId || ddbSpell.sourceId;
                folderId = folders[`spells-${sourceId}`]?.id;
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
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Skipping ${ddbSpell.name} - already exists`);
              results.spells.skipped++;
              continue;
            }

            // Create or update the spell
            if (existingSpell && options.overwriteExisting) {
              // Update existing spell
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Updating existing spell ${ddbSpell.name}`);
              await existingSpell.update({
                ...foundrySpell,
                folder: folderId
              });
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Successfully updated ${ddbSpell.name}`);
            } else {
              // Create new spell
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Creating new spell ${ddbSpell.name}`);
              const createdSpell = await Item.create({
                ...foundrySpell,
                folder: folderId
              });
              console.log(`D&D Beyond Enhanced Importer | DEBUG: Successfully created ${ddbSpell.name}:`, createdSpell);
            }

            results.spells.success++;
          } catch (error) {
            console.error(`D&D Beyond Enhanced Importer | Error importing spell ${ddbSpell.name}:`, error);
            console.error(`D&D Beyond Enhanced Importer | DEBUG: Error stack:`, error.stack);
            results.spells.error++;
          }
        }
        
        // Close the progress bar
        spellProgress.close();
      }
      
      // Update the last sync date
      await game.settings.set('dnd-beyond-enhanced-importer', 'lastSync', new Date().toISOString());

      console.log('D&D Beyond Enhanced Importer | DEBUG: Import complete. Final results:', results);
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
    // Check if item has sources array (API format)
    if (item.sources && Array.isArray(item.sources)) {
      return item.sources.some(source => selectedSources.includes(source.sourceId));
    }
    // Fallback to sourceId property (local database format)
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

  static DEFAULT_OPTIONS = {
    id: 'ddb-import-progress',
    window: {
      title: 'Importing...'
    },
    position: {
      width: 400
    }
  };

  static PARTS = {
    progress: {
      template: 'modules/dnd-beyond-enhanced-importer/templates/progress.html'
    }
  };

  _prepareContext(options) {
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