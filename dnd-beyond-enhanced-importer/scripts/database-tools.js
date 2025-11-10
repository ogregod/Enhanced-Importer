// D&D Beyond Enhanced Importer
// Database Tools for Developers

/**
 * Class for providing tools to help populate and manage the item database
 */
export class DatabaseTools {
  /**
   * Register item test controls on the UI
   */
  static registerItemTestControls() {
    // Only for GMs
    if (!game.user.isGM) return;
    
    // Add "Add to Database" button to item sheets
    Hooks.on('getItemSheetHeaderButtons', (sheet, buttons) => {
      buttons.unshift({
        label: 'Add to DDB Importer Database',
        class: 'add-to-ddb-database',
        icon: 'fas fa-database',
        onclick: () => {
          const item = sheet.item;
          
          // Create a dialog to select the source
          new Dialog({
            title: 'Add Item to DDB Importer Database',
            content: `
              <p>Add this item to the DDB Importer database:</p>
              <div class="form-group">
                <label for="source-id">D&D Beyond Source ID:</label>
                <input type="number" id="source-id" name="sourceId" value="1" min="1">
              </div>
              <div class="form-group">
                <label for="source-name">Source Book Name:</label>
                <select id="source-name" name="sourceName">
                  <option value="">-- Select Source --</option>
                  <option value="1">Player's Handbook</option>
                  <option value="2">Dungeon Master's Guide</option>
                  <option value="3">Monster Manual</option>
                  <option value="5">Basic Rules</option>
                  <option value="6">Sword Coast Adventurer's Guide</option>
                  <option value="7">Volo's Guide to Monsters</option>
                  <option value="8">Xanathar's Guide to Everything</option>
                  <option value="9">Mordenkainen's Tome of Foes</option>
                  <option value="15">Tasha's Cauldron of Everything</option>
                  <option value="27">The Book of Many Things</option>
                </select>
              </div>
              <p class="notes">The source ID should match the D&D Beyond source book ID.</p>
              
              <script>
                // Sync the dropdown with the ID field
                $('#source-name').on('change', function() {
                  $('#source-id').val($(this).val());
                });
                $('#source-id').on('change', function() {
                  $('#source-name').val($(this).val());
                });
              </script>
            `,
            buttons: {
              add: {
                icon: '<i class="fas fa-plus"></i>',
                label: 'Add to Database',
                callback: html => {
                  const sourceId = parseInt(html.find('#source-id').val());
                  DatabaseTools.addItemToDatabase(item, sourceId);
                }
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel'
              }
            },
            default: 'add',
            width: 400
          }).render(true);
        }
      });
    });
    
    // Add a button to the sidebar
    Hooks.on('renderSidebarTab', (app, html) => {
      if (app.tabName !== 'items') return;
      
      const button = $(`
        <button class="export-database">
          <i class="fas fa-database"></i> Export DDB Database
        </button>
      `);
      
      button.click(ev => {
        ev.preventDefault();
        DatabaseTools.exportItemsDatabase();
      });
      
      html.find('.directory-footer').append(button);
    });
  }
  
  /**
   * Add an item to the database
   * @param {Item} item - The Foundry item to add
   * @param {number} sourceId - The D&D Beyond source ID
   */
  static async addItemToDatabase(item, sourceId) {
    try {
      // Get current database
      const response = await fetch(`modules/dnd-beyond-enhanced-importer/database/items.json`);
      let items = [];
      
      if (response.ok) {
        items = await response.json();
      }
      
      // Create the database entry
      const dbItem = {
        name: item.name,
        sourceId: sourceId,
        type: item.type,
        img: item.img,
        system: item.system,
        effects: item.effects?.map(e => e.toObject()) || [],
        flags: item.flags || {}
      };
      
      // Add DDB Importer flags if not present
      if (!dbItem.flags['dnd-beyond-enhanced-importer']) {
        dbItem.flags['dnd-beyond-enhanced-importer'] = {
          ddbId: 0, // Placeholder
          sourceId: sourceId,
          importVersion: '1.0.0'
        };
      }
      
      // Check if item already exists
      const existingIndex = items.findIndex(i => i.name === item.name && i.sourceId === sourceId);
      
      if (existingIndex >= 0) {
        // Confirm replacement
        const confirm = await Dialog.confirm({
          title: 'Replace Item',
          content: `<p>An item with the name "${item.name}" already exists in the database for this source. Do you want to replace it?</p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });
        
        if (confirm) {
          // Replace existing item
          items[existingIndex] = dbItem;
          ui.notifications.info(`Updated item "${item.name}" in database.`);
        } else {
          ui.notifications.warn('Item update cancelled.');
          return;
        }
      } else {
        // Add new item
        items.push(dbItem);
        ui.notifications.info(`Added item "${item.name}" to database.`);
      }
      
      // Export the updated database
      const blob = new Blob([JSON.stringify(items, null, 2)], {type: 'application/json'});
      saveAs(blob, 'items.json');
      
      ui.notifications.info('Downloaded updated items.json file. Replace the existing file in the module.');
    } catch (error) {
      console.error('Error updating database:', error);
      ui.notifications.error('Error updating database. See console for details.');
    }
  }
  
  /**
   * Add a spell to the database
   * @param {Item} spell - The Foundry spell to add
   * @param {number} sourceId - The D&D Beyond source ID
   */
  static async addSpellToDatabase(spell, sourceId) {
    try {
      // Get current database
      const response = await fetch(`modules/dnd-beyond-enhanced-importer/database/spells.json`);
      let spells = [];
      
      if (response.ok) {
        spells = await response.json();
      }
      
      // Create the database entry
      const dbSpell = {
        name: spell.name,
        sourceId: sourceId,
        type: spell.type,
        img: spell.img,
        system: spell.system,
        effects: spell.effects?.map(e => e.toObject()) || [],
        flags: spell.flags || {}
      };
      
      // Add DDB Importer flags if not present
      if (!dbSpell.flags['dnd-beyond-enhanced-importer']) {
        dbSpell.flags['dnd-beyond-enhanced-importer'] = {
          ddbId: 0, // Placeholder
          sourceId: sourceId,
          importVersion: '1.0.0'
        };
      }
      
      // Check if spell already exists
      const existingIndex = spells.findIndex(s => s.name === spell.name && s.sourceId === sourceId);
      
      if (existingIndex >= 0) {
        // Confirm replacement
        const confirm = await Dialog.confirm({
          title: 'Replace Spell',
          content: `<p>A spell with the name "${spell.name}" already exists in the database for this source. Do you want to replace it?</p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });
        
        if (confirm) {
          // Replace existing spell
          spells[existingIndex] = dbSpell;
          ui.notifications.info(`Updated spell "${spell.name}" in database.`);
        } else {
          ui.notifications.warn('Spell update cancelled.');
          return;
        }
      } else {
        // Add new spell
        spells.push(dbSpell);
        ui.notifications.info(`Added spell "${spell.name}" to database.`);
      }
      
      // Export the updated database
      const blob = new Blob([JSON.stringify(spells, null, 2)], {type: 'application/json'});
      saveAs(blob, 'spells.json');
      
      ui.notifications.info('Downloaded updated spells.json file. Replace the existing file in the module.');
    } catch (error) {
      console.error('Error updating database:', error);
      ui.notifications.error('Error updating database. See console for details.');
    }
  }
  
  /**
   * Export the entire database of items
   */
  static async exportItemsDatabase() {
    try {
      const itemsPromise = fetch(`modules/dnd-beyond-enhanced-importer/database/items.json`).then(r => r.json());
      const spellsPromise = fetch(`modules/dnd-beyond-enhanced-importer/database/spells.json`).then(r => r.json());
      
      const [items, spells] = await Promise.all([itemsPromise, spellsPromise]);
      
      // Create a dialog to show statistics
      new Dialog({
        title: 'Database Statistics',
        content: `
          <p>Current database contains:</p>
          <ul>
            <li><strong>Items:</strong> ${items.length}</li>
            <li><strong>Spells:</strong> ${spells.length}</li>
          </ul>
          <p>Click "Export" to download the current database files.</p>
        `,
        buttons: {
          items: {
            icon: '<i class="fas fa-sword"></i>',
            label: 'Export Items',
            callback: () => {
              const blob = new Blob([JSON.stringify(items, null, 2)], {type: 'application/json'});
              saveAs(blob, 'items.json');
            }
          },
          spells: {
            icon: '<i class="fas fa-magic"></i>',
            label: 'Export Spells',
            callback: () => {
              const blob = new Blob([JSON.stringify(spells, null, 2)], {type: 'application/json'});
              saveAs(blob, 'spells.json');
            }
          },
          both: {
            icon: '<i class="fas fa-download"></i>',
            label: 'Export Both',
            callback: () => {
              const itemsBlob = new Blob([JSON.stringify(items, null, 2)], {type: 'application/json'});
              const spellsBlob = new Blob([JSON.stringify(spells, null, 2)], {type: 'application/json'});
              saveAs(itemsBlob, 'items.json');
              setTimeout(() => {
                saveAs(spellsBlob, 'spells.json');
              }, 500);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: 'Cancel'
          }
        },
        default: 'both'
      }).render(true);
    } catch (error) {
      console.error('Error exporting database:', error);
      ui.notifications.error('Error exporting database. See console for details.');
    }
  }
  
  /**
   * Register a button to add spells to the database
   * This is a separate function because spells are handled differently in Foundry
   */
  static registerSpellTestControls() {
    // Only for GMs
    if (!game.user.isGM) return;
    
    // Add "Add to Database" button to spell sheets
    Hooks.on('getItemSheetHeaderButtons', (sheet, buttons) => {
      if (sheet.item.type !== 'spell') return;
      
      buttons.unshift({
        label: 'Add to DDB Spell Database',
        class: 'add-to-ddb-spell-database',
        icon: 'fas fa-hat-wizard',
        onclick: () => {
          const spell = sheet.item;
          
          // Create a dialog to select the source
          new Dialog({
            title: 'Add Spell to DDB Importer Database',
            content: `
              <p>Add this spell to the DDB Importer database:</p>
              <div class="form-group">
                <label for="source-id">D&D Beyond Source ID:</label>
                <input type="number" id="source-id" name="sourceId" value="1" min="1">
              </div>
              <div class="form-group">
                <label for="source-name">Source Book Name:</label>
                <select id="source-name" name="sourceName">
                  <option value="">-- Select Source --</option>
                  <option value="1">Player's Handbook</option>
                  <option value="5">Basic Rules</option>
                  <option value="8">Xanathar's Guide to Everything</option>
                  <option value="15">Tasha's Cauldron of Everything</option>
                </select>
              </div>
              <p class="notes">The source ID should match the D&D Beyond source book ID.</p>
              
              <script>
                // Sync the dropdown with the ID field
                $('#source-name').on('change', function() {
                  $('#source-id').val($(this).val());
                });
                $('#source-id').on('change', function() {
                  $('#source-name').val($(this).val());
                });
              </script>
            `,
            buttons: {
              add: {
                icon: '<i class="fas fa-plus"></i>',
                label: 'Add to Database',
                callback: html => {
                  const sourceId = parseInt(html.find('#source-id').val());
                  DatabaseTools.addSpellToDatabase(spell, sourceId);
                }
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: 'Cancel'
              }
            },
            default: 'add',
            width: 400
          }).render(true);
        }
      });
    });
  }
  
  /**
   * Add a simple FileSaver implementation since Foundry doesn't have one built-in
   */
  static setupFileSaver() {
    // Define the saveAs function if it doesn't exist
    if (typeof window.saveAs !== 'function') {
      window.saveAs = function(blob, fileName) {
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 0);
      };
    }
  }
}

// Register the database tools when Foundry is ready
Hooks.once('ready', () => {
  DatabaseTools.setupFileSaver();
  DatabaseTools.registerItemTestControls();
  DatabaseTools.registerSpellTestControls();
});