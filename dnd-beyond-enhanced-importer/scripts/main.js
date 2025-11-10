// D&D Beyond Enhanced Importer
// Main Module Entry Point

import { registerSettings } from './settings.js';
import { DnDBeyondEnhancedAPI } from './api.js';
import { EnhancedImporter } from './importer.js';

/**
 * Main module class
 */
export class DnDBeyondEnhancedImporter {
  static ID = 'dnd-beyond-enhanced-importer';
  static API = null;
  static Importer = null;
  
  /**
   * Initialize the module
   */
  static async init() {
    console.log('D&D Beyond Enhanced Importer | Initializing');
    
    // Register module settings
    registerSettings();
    
    // Initialize the API
    this.API = new DnDBeyondEnhancedAPI();
    
    // Initialize the Importer
    this.Importer = new EnhancedImporter();
    
    // Register the module directory for use with external scripts and templates
    game.modules.get(this.ID).api = {
      importer: this.Importer,
      api: this.API,
    };
  }
  
  /**
   * Set up the module when Foundry is ready
   */
  static async ready() {
    console.log('D&D Beyond Enhanced Importer | Ready');
    
    // Add importer button to sidebar
    this._addImporterButton();
    
    // Check if we need to update the Cobalt cookie
    const cobaltCookie = game.settings.get(this.ID, 'cobaltCookie');
    if (!cobaltCookie) {
      // Suggest setting up the Cobalt cookie if not already set
      this._suggestCobaltSetup();
    }
  }
  
  /**
   * Add the importer button to the sidebar
   * @private
   */
  static _addImporterButton() {
    const button = $(`
      <div class="action-buttons flexrow">
        <button id="ddb-importer-button">
          <i class="fas fa-download"></i> Import D&D Beyond
        </button>
      </div>
    `);
    
    button.click(ev => {
      ev.preventDefault();
      this.Importer.showImportDialog();
    });
    
    $("#sidebar").find(".directory-footer").append(button);
  }
  
  /**
   * Suggest setting up the Cobalt cookie if not already set
   * @private
   */
  static _suggestCobaltSetup() {
    // Only show to GMs
    if (!game.user.isGM) return;
    
    const content = `
      <p>The D&D Beyond Enhanced Importer requires a Cobalt cookie from D&D Beyond to access your purchased content.</p>
      <p>Please go to Settings > Module Settings > D&D Beyond Enhanced Importer to set up your Cobalt cookie.</p>
    `;
    
    new Dialog({
      title: "D&D Beyond Enhanced Importer Setup",
      content: content,
      buttons: {
        setup: {
          icon: '<i class="fas fa-cog"></i>',
          label: "Go to Settings",
          callback: () => {
            const settings = game.settings.menus.get("core.moduleSettings");
            if (settings) {
              const app = new settings.type();
              app.render(true);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Later"
        }
      },
      default: "setup"
    }).render(true);
  }
}

/* -------------------------------------------- */
/*  Hook Registration                           */
/* -------------------------------------------- */

Hooks.once('init', async () => {
  await DnDBeyondEnhancedImporter.init();
});

Hooks.once('ready', async () => {
  await DnDBeyondEnhancedImporter.ready();
});
