// D&D Beyond Enhanced Importer
// Settings Registration

/**
 * Register all module settings
 */
export function registerSettings() {
  // Register Cobalt Cookie setting
  game.settings.register('dnd-beyond-enhanced-importer', 'cobaltCookie', {
    name: 'D&D Beyond Cobalt Cookie',
    hint: 'Your D&D Beyond Cobalt Cookie, used to authenticate with D&D Beyond and access your purchased content.',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    onChange: value => {
      // Validate the cookie when changed
      validateCobaltCookie(value);
    }
  });
  
  // Last sync date
  game.settings.register('dnd-beyond-enhanced-importer', 'lastSync', {
    name: 'Last Synchronization',
    hint: 'Date of last successful synchronization with D&D Beyond.',
    scope: 'world',
    config: true,
    type: String,
    default: '',
    onChange: () => {}
  });
  
  // Import sources (which books are enabled)
  game.settings.register('dnd-beyond-enhanced-importer', 'importSources', {
    name: 'Import Sources',
    hint: 'Which D&D Beyond source books to import content from.',
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: () => {}
  });
  
  // Import configuration
  game.settings.register('dnd-beyond-enhanced-importer', 'importConfig', {
    name: 'Import Configuration',
    hint: 'Configuration options for the import process.',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      importItems: true,
      importSpells: true,
      createFolders: true,
      folderStructure: 'sourceBook', // Can be 'sourceBook', 'itemType', 'flat'
      overwriteExisting: true,
    },
    onChange: () => {}
  });
  
  // Register the submenu for import settings
  game.settings.registerMenu('dnd-beyond-enhanced-importer', 'importerConfig', {
    name: 'Importer Settings',
    label: 'Configure Importer',
    hint: 'Configure how content is imported from D&D Beyond.',
    icon: 'fas fa-cogs',
    type: ImporterConfigDialog,
    restricted: true
  });
  
  // Register the help menu
  game.settings.registerMenu('dnd-beyond-enhanced-importer', 'importerHelp', {
    name: 'Help & Instructions',
    label: 'How to Use',
    hint: 'Instructions for setting up and using the Enhanced Importer.',
    icon: 'fas fa-question-circle',
    type: ImporterHelpDialog,
    restricted: false
  });
}

/**
 * Validate a Cobalt Cookie to ensure it's valid
 * @param {string} cookie - The Cobalt cookie to validate
 */
async function validateCobaltCookie(cookie) {
  if (!cookie) return;

  try {
    // Import the API class
    const { DnDBeyondEnhancedAPI } = await import('./api.js');
    const api = new DnDBeyondEnhancedAPI();
    
    // Test the cookie
    const valid = await api.validateCookie(cookie);
    
    if (valid) {
      ui.notifications.info('D&D Beyond Enhanced Importer: Cobalt Cookie validated successfully.');
    } else {
      ui.notifications.error('D&D Beyond Enhanced Importer: Invalid Cobalt Cookie. Please check and try again.');
    }
  } catch (error) {
    console.error('D&D Beyond Enhanced Importer | Error validating cookie:', error);
    ui.notifications.error('D&D Beyond Enhanced Importer: Error validating cookie. Check the console for details.');
  }
}

/**
 * Dialog for configuring importer settings
 */
class ImporterConfigDialog extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'ddb-importer-config',
      title: 'D&D Beyond Importer Configuration',
      template: 'modules/dnd-beyond-enhanced-importer/templates/importer-config.html',
      width: 500,
      closeOnSubmit: true
    });
  }
  
  getData() {
    // Get the current import configuration
    const importConfig = game.settings.get('dnd-beyond-enhanced-importer', 'importConfig');
    
    return {
      importConfig: importConfig
    };
  }
  
  async _updateObject(event, formData) {
    // Save the form data to the settings
    await game.settings.set('dnd-beyond-enhanced-importer', 'importConfig', {
      importItems: formData.importItems,
      importSpells: formData.importSpells,
      createFolders: formData.createFolders,
      folderStructure: formData.folderStructure,
      overwriteExisting: formData.overwriteExisting
    });
    
    ui.notifications.info('Importer configuration updated.');
  }
}

/**
 * Dialog for showing help and instructions
 */
class ImporterHelpDialog extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'ddb-importer-help',
      title: 'D&D Beyond Enhanced Importer - Help',
      template: 'modules/dnd-beyond-enhanced-importer/templates/importer-help.html',
      width: 600,
      height: 700,
      resizable: true,
      closeOnSubmit: false,
      submitOnClose: false
    });
  }
  
  getData() {
    return {};
  }
  
  async _updateObject(event, formData) {
    // This dialog doesn't update anything
  }
}
