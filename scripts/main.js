// D&D Beyond Enhanced Importer
// Main Module Entry Point

import { registerSettings } from './settings.js';
import { DnDBeyondEnhancedAPI } from './api.js';
import { EnhancedImporter } from './importer.js';
import { DatabaseTools } from './database-tools.js';

/**
 * Preload Handlebars templates
 */
async function preloadTemplates() {
  console.log('D&D Beyond Enhanced Importer | Preloading templates');
  
  const templatePaths = [
    'modules/dnd-beyond-enhanced-importer/templates/import-dialog.html',
    'modules/dnd-beyond-enhanced-importer/templates/importer-config.html',
    'modules/dnd-beyond-enhanced-importer/templates/importer-help.html',
    'modules/dnd-beyond-enhanced-importer/templates/progress.html',
    'modules/dnd-beyond-enhanced-importer/templates/homebrew-tab.html'
  ];
  
  try {
    return loadTemplates(templatePaths);
  } catch (error) {
    console.error('D&D Beyond Enhanced Importer | Error preloading templates:', error);
  }
}

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
    console.log('===========================================');
    console.log('D&D Beyond Enhanced Importer | Initializing');
    console.log('===========================================');
    
    // Register module settings
    try {
      registerSettings();
      console.log('D&D Beyond Enhanced Importer | Settings registered successfully');
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error registering settings:', error);
    }
    
    // Initialize the API
    try {
      this.API = new DnDBeyondEnhancedAPI();
      console.log('D&D Beyond Enhanced Importer | API initialized successfully');
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error initializing API:', error);
    }
    
    // Initialize the Importer
    try {
      this.Importer = new EnhancedImporter();
      console.log('D&D Beyond Enhanced Importer | Importer initialized successfully');
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error initializing Importer:', error);
    }
    
    // Register the module directory for use with external scripts and templates
    try {
      game.modules.get(this.ID).api = {
        importer: this.Importer,
        api: this.API,
      };
      console.log('D&D Beyond Enhanced Importer | Module API registered successfully');
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error registering module API:', error);
    }
    
    // Preload templates
    try {
      await preloadTemplates();
      console.log('D&D Beyond Enhanced Importer | Templates preloaded successfully');
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error preloading templates:', error);
    }
  }
  
  /**
   * Set up the module when Foundry is ready
   */
  static async ready() {
    console.log('=========================================');
    console.log('D&D Beyond Enhanced Importer | Ready');
    console.log('=========================================');
    
    // Check if lib-wrapper dependency is available
    if (!game.modules.get("lib-wrapper")?.active) {
      console.error("D&D Beyond Enhanced Importer | Missing dependency: lib-wrapper");
      ui.notifications.error("D&D Beyond Enhanced Importer requires the 'libWrapper' module. Please install and activate it.");
      return;
    }
    
    // Add importer button to sidebar
    try {
      this._addImporterButton();
      console.log('D&D Beyond Enhanced Importer | Importer button added successfully');
    } catch (error) {
      console.error('D&D Beyond Enhanced Importer | Error adding importer button:', error);
    }
    
    // Check if we need to update the Cobalt cookie
    const cobaltCookie = game.settings.get(this.ID, 'cobaltCookie');
    if (!cobaltCookie) {
      // Suggest setting up the Cobalt cookie if not already set
      this._suggestCobaltSetup();
    }
    
    console.log('D&D Beyond Enhanced Importer | Initialization complete');
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
      console.log('D&D Beyond Enhanced Importer | Importer button clicked');
      this.Importer.showImportDialog();
    });
    
    $("#sidebar").find(".directory-footer").append(button);
    console.log('D&D Beyond Enhanced Importer | Button appended to sidebar');
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
  console.log('D&D Beyond Enhanced Importer | Init hook triggered');
  await DnDBeyondEnhancedImporter.init();
});

Hooks.once('ready', async () => {
  console.log('D&D Beyond Enhanced Importer | Ready hook triggered');
  await DnDBeyondEnhancedImporter.ready();
});