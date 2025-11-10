// D&D Beyond Enhanced Importer
// Compendium Content Manager

import { DnDBeyondEnhancedAPI } from './api.js';
import { convertDDBItemToFoundry, convertDDBSpellToFoundry, getSourceName } from './utilities.js';

/**
 * Class for managing and accessing pre-built compendium content
 */
export class CompendiumManager {
  constructor() {
    this.api = new DnDBeyondEnhancedAPI();
    this.itemCompendium = null;
    this.spellCompendium = null;
    this.initialized = false;
  }
  
  /**
   * Initialize the compendium manager
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    // Get the compendium packs
    this.itemCompendium = game.packs.get('dnd-beyond-enhanced-importer.ddb-items');
    this.spellCompendium = game.packs.get('dnd-beyond-enhanced-importer.ddb-spells');
    
    // Check if the compendiums exist
    if (!this.itemCompendium || !this.spellCompendium) {
      console.error('D&D Beyond Enhanced Importer | Compendium packs not found');
      return;
    }
    
    this.initialized = true;
  }
  
  /**
   * Populate compendiums with default content
   * This should only be used during development to initially create the content
   * @param {Array} sources - Array of sources to include
   * @returns {Promise<object>} Results of the population
   */
  async populateCompendiums(sources) {
    if (!this.initialized) await this.initialize();
    
    const results = {
      items: {
        added: 0,
        error: 0
      },
      spells: {
        added: 0,
        error: 0
      }
    };
    
    try {
      // Get items from D&D Beyond
      const items = await this.api.getItems();
      
      // Filter to only selected sources
      const filteredItems = items.filter(item => sources.includes(item.sourceId));
      
      // Create a progress bar
      const itemProgress = new Progress({
        label: 'Adding Items to Compendium',
        pct: 0,
        step: 0,
        total: filteredItems.length,
        animate: false
      });
      itemProgress.render(true);
      
      // Process each item
      for (let i = 0; i < filteredItems.length; i++) {
        const ddbItem = filteredItems[i];
        
        try {
          // Update progress
          itemProgress.label = `Adding Item: ${ddbItem.name}`;
          itemProgress.pct = Math.round((i / filteredItems.length) * 100);
          itemProgress.step = i;
          itemProgress.render(true);
          
          // Get detailed item information
          const itemDetails = await this.api.getItemDetails(ddbItem.id);
          
          // Convert to Foundry format
          const foundryItem = await convertDDBItemToFoundry(itemDetails, sources);
          
          // Add to compendium
          await this.itemCompendium.documentClass.create(foundryItem, {pack: this.itemCompendium.collection});
          
          results.items.added++;
        } catch (error) {
          console.error(`D&D Beyond Enhanced Importer | Error adding item ${ddbItem.name} to compendium:`, error);
          results.items.error++;
        }
      }
      
      // Close the progress bar
      itemProgress.close();
      
      // Get spells from D&D Beyond
      const spells = await this.api.getSpells();
      
      // Filter to only selected sources
      const filteredSpells = spells.filter(spell => sources.includes(spell.sourceId));
      
      // Create a progress bar
      const spellProgress = new Progress({
        label: 'Adding Spells to Compendium',
        pct: 0,
        step: 0,
        total: filteredSpells.length,
        animate: false
      });
      spellProgress.render(true);
      
      // Process each spell
      for (let i = 0; i < filteredSpells.length; i++) {
        const ddbSpell = filteredSpells[i];
        
        try {
          // Update progress
          spellProgress.label = `Adding Spell: ${ddbSpell.name}`;
          spellProgress.pct = Math.round((i / filteredSpells.length) * 100);
          spellProgress.step = i;
          spellProgress.render(true);
          
          // Get detailed spell information
          const spellDetails = await this.api.getSpellDetails(ddbSpell.id);
          
          // Convert to Foundry format
          const foundrySpell = await convertDDBSpellToFoundry(spellDetails, sources);
          
          // Add to compendium
          await this.spellCompendium.documentClass.create(foundrySpell, {pack: this.spellCompendium.collection});
          
          results.spells.added++;
        } catch (error) {
          console.error(`D&D Beyond Enhanced Importer | Error adding spell ${ddbSpell.name} to compendium:`, error);
          results.spells.error++;
        }
      }
      
      // Close the progress bar
      spellProgress.close();
      
      return results;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error populating compendiums:', error);
      throw error;
    }
  }
  
  /**
   * Get all items from the compendium
   * @returns {Promise<Array>} Array of items
   */
  async getItems() {
    if (!this.initialized) await this.initialize();
    
    // Get all items from the compendium
    const items = await this.itemCompendium.getDocuments();
    return items;
  }
  
  /**
   * Get all spells from the compendium
   * @returns {Promise<Array>} Array of spells
   */
  async getSpells() {
    if (!this.initialized) await this.initialize();
    
    // Get all spells from the compendium
    const spells = await this.spellCompendium.getDocuments();
    return spells;
  }
  
  /**
   * Get an item by name
   * @param {string} name - The item name
   * @returns {Promise<object|null>} The item or null if not found
   */
  async getItemByName(name) {
    if (!this.initialized) await this.initialize();
    
    // Get the index
    const index = await this.itemCompendium.getIndex();
    
    // Find the entry by name
    const entry = index.find(e => e.name === name);
    if (!entry) return null;
    
    // Get the document
    return await this.itemCompendium.getDocument(entry._id);
  }
  
  /**
   * Get a spell by name
   * @param {string} name - The spell name
   * @returns {Promise<object|null>} The spell or null if not found
   */
  async getSpellByName(name) {
    if (!this.initialized) await this.initialize();
    
    // Get the index
    const index = await this.spellCompendium.getIndex();
    
    // Find the entry by name
    const entry = index.find(e => e.name === name);
    if (!entry) return null;
    
    // Get the document
    return await this.spellCompendium.getDocument(entry._id);
  }
  
  /**
   * Add a GM-only function to populate compendiums during development
   * This adds a button to the module settings dialog
   */
  static registerPopulationControls() {
    // Only for GMs
    if (!game.user.isGM) return;
    
    // Add a button to the module settings
    const moduleSettings = game.settings.menus.get('core.moduleSettings');
    if (moduleSettings) {
      const app = new moduleSettings.type();
      
      // Hook into the render event
      Hooks.on('renderSettingsConfig', (app, html, data) => {
        // Find the D&D Beyond Enhanced Importer section
        const header = html.find('h2.module-header:contains("D&D Beyond Enhanced Importer")');
        if (header.length > 0) {
          // Add a button after the header
          const button = $(`
            <button type="button" class="populate-compendiums" style="margin-left: 10px;">
              <i class="fas fa-database"></i> Populate Compendiums (Dev)
            </button>
          `);
          
          // Add the button after the header
          header.after(button);
          
          // Add a click handler
          button.click(async event => {
            event.preventDefault();
            
            // Confirm with the user
            const confirm = await Dialog.confirm({
              title: 'Populate Compendiums',
              content: `<p>This will populate the module compendiums with content from D&D Beyond. This should only be used during development and requires a valid Cobalt cookie.</p><p>Are you sure you want to proceed?</p>`,
              yes: () => true,
              no: () => false,
              defaultYes: false
            });
            
            if (!confirm) return;
            
            try {
              // Get the sources
              const api = new DnDBeyondEnhancedAPI();
              const sources = await api.getSources();
              
              // Show a dialog to select sources
              const sourceDialog = new Dialog({
                title: 'Select Sources',
                content: `
                  <p>Select which sources to include in the compendiums.</p>
                  <div style="max-height: 400px; overflow-y: auto; margin-bottom: 10px; border: 1px solid #ccc; padding: 5px;">
                    ${sources.map(source => `
                      <div style="margin-bottom: 5px;">
                        <label>
                          <input type="checkbox" name="source-${source.id}" value="${source.id}" checked>
                          ${source.name}
                        </label>
                      </div>
                    `).join('')}
                  </div>
                `,
                buttons: {
                  populate: {
                    icon: '<i class="fas fa-database"></i>',
                    label: 'Populate',
                    callback: async html => {
                      // Get selected sources
                      const selectedSources = [];
                      sources.forEach(source => {
                        const checkbox = html.find(`input[name="source-${source.id}"]`);
                        if (checkbox.prop('checked')) {
                          selectedSources.push(source.id);
                        }
                      });
                      
                      if (selectedSources.length === 0) {
                        ui.notifications.warn('Please select at least one source.');
                        return;
                      }
                      
                      try {
                        // Create the compendium manager
                        const manager = new CompendiumManager();
                        await manager.initialize();
                        
                        // Populate the compendiums
                        ui.notifications.info('Populating compendiums...');
                        const results = await manager.populateCompendiums(selectedSources);
                        
                        // Show results
                        new Dialog({
                          title: 'Compendium Population Results',
                          content: `
                            <h3>Items:</h3>
                            <ul>
                              <li>Added: ${results.items.added}</li>
                              <li>Errors: ${results.items.error}</li>
                            </ul>
                            <h3>Spells:</h3>
                            <ul>
                              <li>Added: ${results.spells.added}</li>
                              <li>Errors: ${results.spells.error}</li>
                            </ul>
                          `,
                          buttons: {
                            close: {
                              icon: '<i class="fas fa-check"></i>',
                              label: 'Close'
                            }
                          }
                        }).render(true);
                      } catch (error) {
                        console.error('D&D Beyond Enhanced Importer | Error populating compendiums:', error);
                        ui.notifications.error('Error populating compendiums. Please check the console for details.');
                      }
                    }
                  },
                  cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                  }
                },
                default: 'cancel'
              });
              
              sourceDialog.render(true);
            } catch (error) {
              console.error('D&D Beyond Enhanced Importer | Error getting sources:', error);
              ui.notifications.error('Error getting sources. Please check the console for details.');
            }
          });
        }
      });
    }
  }
}

// Register the compendium population controls
Hooks.once('ready', () => {
  CompendiumManager.registerPopulationControls();
});
