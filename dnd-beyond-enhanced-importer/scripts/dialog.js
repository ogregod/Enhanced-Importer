// D&D Beyond Enhanced Importer
// Import Dialog

/**
 * Dialog for selecting sources to import
 */
export class ImportDialog extends Application {
  constructor(importer) {
    super();
    this.importer = importer;
    this.sources = [];
    this.selectedSources = [];
    this.loading = true;
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'ddb-import-dialog',
      title: 'D&D Beyond Enhanced Importer',
      template: 'modules/dnd-beyond-enhanced-importer/templates/import-dialog.html',
      width: 600,
      height: 700,
      resizable: true,
      closeOnSubmit: false
    });
  }
  
  async getData() {
    // Load sources if we don't have them yet
    if (this.loading) {
      try {
        this.sources = await this.importer.fetchSources();
        
        // Get previously selected sources from settings
        const savedSources = game.settings.get('dnd-beyond-enhanced-importer', 'importSources');
        
        // Initialize selected sources from saved settings or select all by default
        this.selectedSources = Object.keys(savedSources).length > 0
          ? this.sources.filter(s => savedSources[s.id]).map(s => s.id)
          : this.sources.map(s => s.id);
        
        this.loading = false;
      } catch (error) {
        console.error('D&D Beyond Enhanced Importer | Error loading sources:', error);
        ui.notifications.error('Error loading sources. Please check the console for details.');
      }
    }
    
    // Get import configuration
    const importConfig = game.settings.get('dnd-beyond-enhanced-importer', 'importConfig');
    
    return {
      sources: this.sources,
      selectedSources: this.selectedSources,
      loading: this.loading,
      importConfig: importConfig,
      lastSync: game.settings.get('dnd-beyond-enhanced-importer', 'lastSync')
        ? new Date(game.settings.get('dnd-beyond-enhanced-importer', 'lastSync')).toLocaleString()
        : 'Never'
    };
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    // Toggle all sources button
    html.find('.toggle-all-sources').click(event => {
      event.preventDefault();
      
      const allSelected = this.selectedSources.length === this.sources.length;
      
      if (allSelected) {
        // Deselect all
        this.selectedSources = [];
        html.find('.source-select').prop('checked', false);
      } else {
        // Select all
        this.selectedSources = this.sources.map(s => s.id);
        html.find('.source-select').prop('checked', true);
      }
      
      this._updateButtonState(html);
    });
    
    // Handle source selection
    html.find('.source-select').change(event => {
      const sourceId = parseInt(event.target.value);
      const checked = event.target.checked;
      
      if (checked) {
        // Add to selected sources
        if (!this.selectedSources.includes(sourceId)) {
          this.selectedSources.push(sourceId);
        }
      } else {
        // Remove from selected sources
        this.selectedSources = this.selectedSources.filter(id => id !== sourceId);
      }
      
      this._updateButtonState(html);
    });
    
    // Import button
    html.find('.import-button').click(async event => {
      event.preventDefault();
      
      if (this.selectedSources.length === 0) {
        ui.notifications.warn('Please select at least one source to import.');
        return;
      }
      
      // Get import options
      const importItems = html.find('#import-items').prop('checked');
      const importSpells = html.find('#import-spells').prop('checked');
      const createFolders = html.find('#create-folders').prop('checked');
      const folderStructure = html.find('#folder-structure').val();
      const overwriteExisting = html.find('#overwrite-existing').prop('checked');
      
      if (!importItems && !importSpells) {
        ui.notifications.warn('Please select at least one content type to import (items or spells).');
        return;
      }
      
      // Save settings
      await game.settings.set('dnd-beyond-enhanced-importer', 'importConfig', {
        importItems,
        importSpells,
        createFolders,
        folderStructure,
        overwriteExisting
      });
      
      // Save selected sources
      const sourcesObj = {};
      for (const source of this.sources) {
        sourcesObj[source.id] = this.selectedSources.includes(source.id);
      }
      await game.settings.set('dnd-beyond-enhanced-importer', 'importSources', sourcesObj);
      
      // Disable the import button
      html.find('.import-button').prop('disabled', true).text('Importing...');
      
      try {
        // Start the import
        const results = await this.importer.importContent(this.selectedSources, {
          importItems,
          importSpells,
          createFolders,
          folderStructure,
          overwriteExisting
        });
        
        // Show results
        this._showResults(results);
        
        // Close the dialog
        this.close();
      } catch (error) {
        console.error('D&D Beyond Enhanced Importer | Error importing content:', error);
        ui.notifications.error('Error importing content. Please check the console for details.');
        
        // Re-enable the import button
        html.find('.import-button').prop('disabled', false).text('Import Selected Sources');
      }
    });
    
    // Update the Cobalt cookie button
    html.find('.update-cobalt').click(event => {
      event.preventDefault();
      this.close();
      
      // Show the Cobalt cookie dialog
      this.importer._showCobaltSetupDialog();
    });
    
    // Initialize button state
    this._updateButtonState(html);
  }
  
  /**
   * Update the state of the import button
   * @param {jQuery} html - The jQuery object for the dialog
   * @private
   */
  _updateButtonState(html) {
    const importButton = html.find('.import-button');
    
    if (this.selectedSources.length === 0) {
      importButton.prop('disabled', true);
    } else {
      importButton.prop('disabled', false);
    }
    
    // Update toggle all button text
    const toggleAllButton = html.find('.toggle-all-sources');
    const allSelected = this.selectedSources.length === this.sources.length;
    
    toggleAllButton.text(allSelected ? 'Deselect All' : 'Select All');
  }
  
  /**
   * Show import results
   * @param {object} results - The import results
   * @private
   */
  _showResults(results) {
    const content = `
      <h3>Import Complete</h3>
      <h4>Items:</h4>
      <ul>
        <li>Successfully imported: ${results.items.success}</li>
        <li>Skipped (already exists): ${results.items.skipped}</li>
        <li>Errors: ${results.items.error}</li>
      </ul>
      <h4>Spells:</h4>
      <ul>
        <li>Successfully imported: ${results.spells.success}</li>
        <li>Skipped (already exists): ${results.spells.skipped}</li>
        <li>Errors: ${results.spells.error}</li>
      </ul>
    `;
    
    new Dialog({
      title: 'D&D Beyond Import Results',
      content: content,
      buttons: {
        close: {
          icon: '<i class="fas fa-check"></i>',
          label: 'Close'
        }
      }
    }).render(true);
  }
}
