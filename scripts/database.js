// D&D Beyond Enhanced Importer
// Pre-tested Item Database Manager

/**
 * Class for managing the pre-tested item database
 */
export class ItemDatabase {
  constructor() {
    this.items = new Map();
    this.spells = new Map();
    this.sourceMap = new Map();
    this.initialized = false;
  }
  
  /**
   * Initialize the database
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    // Load the database files
    try {
      const itemsResponse = await fetch(`modules/dnd-beyond-enhanced-importer/database/items.json`);
      const spellsResponse = await fetch(`modules/dnd-beyond-enhanced-importer/database/spells.json`);
      const sourcesResponse = await fetch(`modules/dnd-beyond-enhanced-importer/database/sources.json`);
      
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        // Map items by source and name for easy lookup
        itemsData.forEach(item => {
          // Create source entry if it doesn't exist
          if (!this.items.has(item.sourceId)) {
            this.items.set(item.sourceId, new Map());
          }
          // Add item to source
          this.items.get(item.sourceId).set(item.name, item);
        });
      }
      
      if (spellsResponse.ok) {
        const spellsData = await spellsResponse.json();
        // Map spells by source and name for easy lookup
        spellsData.forEach(spell => {
          // Create source entry if it doesn't exist
          if (!this.spells.has(spell.sourceId)) {
            this.spells.set(spell.sourceId, new Map());
          }
          // Add spell to source
          this.spells.get(spell.sourceId).set(spell.name, spell);
        });
      }
      
      if (sourcesResponse.ok) {
        const sourcesData = await sourcesResponse.json();
        // Map sources by ID for easy lookup
        sourcesData.forEach(source => {
          this.sourceMap.set(source.id, source);
        });
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error initializing database:', error);
      throw error;
    }
  }
  
  /**
   * Get all available sources
   * @returns {Array} Array of sources
   */
  getSources() {
    if (!this.initialized) {
      console.error('D&D Beyond Enhanced Importer | Database not initialized');
      return [];
    }
    
    return Array.from(this.sourceMap.values());
  }
  
  /**
   * Get all items for a specific source
   * @param {number} sourceId - The source ID
   * @returns {Array} Array of items for the source
   */
  getItemsForSource(sourceId) {
    if (!this.initialized) {
      console.error('D&D Beyond Enhanced Importer | Database not initialized');
      return [];
    }
    
    // Check if we have items for this source
    if (!this.items.has(sourceId)) {
      return [];
    }
    
    // Return all items for the source
    return Array.from(this.items.get(sourceId).values());
  }
  
  /**
   * Get all spells for a specific source
   * @param {number} sourceId - The source ID
   * @returns {Array} Array of spells for the source
   */
  getSpellsForSource(sourceId) {
    if (!this.initialized) {
      console.error('D&D Beyond Enhanced Importer | Database not initialized');
      return [];
    }
    
    // Check if we have spells for this source
    if (!this.spells.has(sourceId)) {
      return [];
    }
    
    // Return all spells for the source
    return Array.from(this.spells.get(sourceId).values());
  }
  
  /**
   * Get a specific item by source and name
   * @param {number} sourceId - The source ID
   * @param {string} name - The item name
   * @returns {object|null} The item or null if not found
   */
  getItem(sourceId, name) {
    if (!this.initialized) {
      console.error('D&D Beyond Enhanced Importer | Database not initialized');
      return null;
    }
    
    // Check if we have items for this source
    if (!this.items.has(sourceId)) {
      return null;
    }
    
    // Return the item if found
    return this.items.get(sourceId).get(name) || null;
  }
  
  /**
   * Get a specific spell by source and name
   * @param {number} sourceId - The source ID
   * @param {string} name - The spell name
   * @returns {object|null} The spell or null if not found
   */
  getSpell(sourceId, name) {
    if (!this.initialized) {
      console.error('D&D Beyond Enhanced Importer | Database not initialized');
      return null;
    }
    
    // Check if we have spells for this source
    if (!this.spells.has(sourceId)) {
      return null;
    }
    
    // Return the spell if found
    return this.spells.get(sourceId).get(name) || null;
  }
  
  /**
   * Count the total number of items in the database
   * @returns {number} The total number of items
   */
  getItemCount() {
    let count = 0;
    for (const sourceItems of this.items.values()) {
      count += sourceItems.size;
    }
    return count;
  }
  
  /**
   * Count the total number of spells in the database
   * @returns {number} The total number of spells
   */
  getSpellCount() {
    let count = 0;
    for (const sourceSpells of this.spells.values()) {
      count += sourceSpells.size;
    }
    return count;
  }
  
  /**
   * Get items for multiple sources
   * @param {Array} sourceIds - Array of source IDs
   * @returns {Array} Array of items for the sources
   */
  getItemsForSources(sourceIds) {
    const items = [];
    for (const sourceId of sourceIds) {
      items.push(...this.getItemsForSource(sourceId));
    }
    return items;
  }
  
  /**
   * Get spells for multiple sources
   * @param {Array} sourceIds - Array of source IDs
   * @returns {Array} Array of spells for the sources
   */
  getSpellsForSources(sourceIds) {
    const spells = [];
    for (const sourceId of sourceIds) {
      spells.push(...this.getSpellsForSource(sourceId));
    }
    return spells;
  }
  
  /**
   * Tool for developers to export items to the database format
   * @param {Array} items - Array of Foundry items
   * @param {number} sourceId - The source ID
   * @returns {Array} Array of items in database format
   */
  static exportItemsToDatabase(items, sourceId) {
    return items.map(item => ({
      name: item.name,
      sourceId: sourceId,
      type: item.type,
      img: item.img,
      system: item.system,
      effects: item.effects?.map(e => e.toObject()),
      flags: item.flags
    }));
  }
  
  /**
   * Tool for developers to export spells to the database format
   * @param {Array} spells - Array of Foundry items that are spells
   * @param {number} sourceId - The source ID
   * @returns {Array} Array of spells in database format
   */
  static exportSpellsToDatabase(spells, sourceId) {
    return spells.map(spell => ({
      name: spell.name,
      sourceId: sourceId,
      type: spell.type,
      img: spell.img,
      system: spell.system,
      effects: spell.effects?.map(e => e.toObject()),
      flags: spell.flags
    }));
  }
  
  /**
   * Developer tool to add a "Export to Database" button to item sheets
   */
  static registerExportTools() {
    // Only for GMs
    if (!game.user.isGM) return;
    
    // Hook into the item sheet header buttons
    Hooks.on('getItemSheetHeaderButtons', (sheet, buttons) => {
      buttons.unshift({
        label: 'Export for DDB Importer',
        class: 'export-to-ddb-importer',
        icon: 'fas fa-file-export',
        onclick: () => {
          const item = sheet.item;
          
          // Create a dialog to select the source
          new Dialog({
            title: 'Export Item for DDB Importer',
            content: `
              <p>Select the source for this item:</p>
              <div class="form-group">
                <label for="source-id">Source ID:</label>
                <input type="number" id="source-id" name="sourceId" value="1" min="1">
              </div>
              <p class="notes">Note: You'll need to match this ID with the D&D Beyond source ID.</p>
            `,
            buttons: {
              export: {
                icon: '<i class="fas fa-file-export"></i>',
                label: 'Export',
                callback: html => {
                  const sourceId = parseInt(html.find('#source-id').val());
                  
                  // Export the item
                  const exportedData = item.type === 'spell'
                    ? ItemDatabase.exportSpellsToDatabase([item], sourceId)
                    : ItemDatabase.exportItemsToDatabase([item], sourceId);
                  
                  // Show the exported data
                  new Dialog({
                    title: 'Exported Item Data',
                    content: `
                      <p>Copy this data and add it to the appropriate database file:</p>
                      <textarea style="width: 100%; height: 300px; font-family: monospace;">${JSON.stringify(exportedData, null, 2)}</textarea>
                    `,
                    buttons: {
                      copy: {
                        icon: '<i class="fas fa-copy"></i>',
                        label: 'Copy to Clipboard',
                        callback: html => {
                          const textarea = html.find('textarea')[0];
                          textarea.select();
                          document.execCommand('copy');
                          ui.notifications.info('Exported data copied to clipboard.');
                        }
                      },
                      close: {
                        icon: '<i class="fas fa-times"></i>',
                        label: 'Close'
                      }
                    },
                    default: 'copy'
                  }).render(true);
                }
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel'
              }
            },
            default: 'export'
          }).render(true);
        }
      });
    });
    
    // Add a button to the sidebar to bulk export items
    Hooks.on('renderSidebarTab', (app, html, data) => {
      if (app.tabName !== 'items') return;
      
      // Add a button at the bottom of the sidebar
      const button = $(`
        <div class="action-buttons flexrow">
          <button class="bulk-export-to-ddb-importer">
            <i class="fas fa-file-export"></i> Bulk Export for DDB Importer
          </button>
        </div>
      `);
      
      // Add the button after the directory
      html.find('.directory-footer').append(button);
      
      // Add a click handler
      button.find('.bulk-export-to-ddb-importer').click(async event => {
        event.preventDefault();
        
        // Create a dialog to select the source
        new Dialog({
          title: 'Bulk Export Items for DDB Importer',
          content: `
            <p>Select the source for these items:</p>
            <div class="form-group">
              <label for="source-id">Source ID:</label>
              <input type="number" id="source-id" name="sourceId" value="1" min="1">
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="export-all" name="exportAll" checked>
                Export all items
              </label>
            </div>
            <div class="form-group">
              <label for="item-type">Filter by type:</label>
              <select id="item-type" name="itemType" disabled>
                <option value="all">All Types</option>
                <option value="weapon">Weapons</option>
                <option value="equipment">Equipment</option>
                <option value="consumable">Consumables</option>
                <option value="tool">Tools</option>
                <option value="loot">Loot</option>
                <option value="spell">Spells</option>
              </select>
            </div>
            <div class="form-group">
              <label for="item-folder">Filter by folder:</label>
              <select id="item-folder" name="itemFolder" disabled>
                <option value="all">All Folders</option>
                ${game.folders.filter(f => f.type === 'Item').map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
              </select>
            </div>
            <p class="notes">Note: You'll need to match this ID with the D&D Beyond source ID.</p>
            
            <script>
              $('#export-all').change(function() {
                const checked = $(this).prop('checked');
                $('#item-type, #item-folder').prop('disabled', checked);
              });
            </script>
          `,
          buttons: {
            export: {
              icon: '<i class="fas fa-file-export"></i>',
              label: 'Export',
              callback: html => {
                const sourceId = parseInt(html.find('#source-id').val());
                const exportAll = html.find('#export-all').prop('checked');
                const itemType = html.find('#item-type').val();
                const folderId = html.find('#item-folder').val();
                
                // Filter items
                let items = game.items.contents;
                
                if (!exportAll) {
                  if (itemType !== 'all') {
                    items = items.filter(i => i.type === itemType);
                  }
                  
                  if (folderId !== 'all') {
                    items = items.filter(i => i.folder?.id === folderId);
                  }
                }
                
                // Split items into normal items and spells
                const normalItems = items.filter(i => i.type !== 'spell');
                const spells = items.filter(i => i.type === 'spell');
                
                // Export the items
                const exportedItems = ItemDatabase.exportItemsToDatabase(normalItems, sourceId);
                const exportedSpells = ItemDatabase.exportSpellsToDatabase(spells, sourceId);
                
                // Show the exported data
                new Dialog({
                  title: 'Exported Item Data',
                  content: `
                    <p>Copy this data and add it to the appropriate database file:</p>
                    <h3>Items (${normalItems.length})</h3>
                    <textarea style="width: 100%; height: 200px; font-family: monospace;">${JSON.stringify(exportedItems, null, 2)}</textarea>
                    <h3>Spells (${spells.length})</h3>
                    <textarea style="width: 100%; height: 200px; font-family: monospace;">${JSON.stringify(exportedSpells, null, 2)}</textarea>
                  `,
                  buttons: {
                    close: {
                      icon: '<i class="fas fa-times"></i>',
                      label: 'Close'
                    }
                  }
                }).render(true);
              }
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: 'Cancel'
            }
          },
          default: 'export'
        }).render(true);
      });
    });
  }
}

// Register the export tools
Hooks.once('ready', () => {
  ItemDatabase.registerExportTools();
});
