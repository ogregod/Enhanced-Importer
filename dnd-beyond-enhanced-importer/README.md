# D&D Beyond Enhanced Importer for Foundry VTT

This module allows you to import items and spells from your D&D Beyond account into Foundry VTT. All imported content is properly configured with correct pricing, templates, effects, and rolls.

## Features

- Import items and spells from D&D Beyond sources you own
- All items are properly configured with correct pricing, templates, effects, and rolls
- Organize imported content into folders by source book or item type
- Select which sources to import from
- Choose to overwrite or skip existing items

## Requirements

- Foundry VTT (v11 or higher)
- D&D 5e system for Foundry VTT
- An active D&D Beyond account with purchased content
- A valid Cobalt cookie from your D&D Beyond account

## Installation

1. In the Foundry VTT setup screen, go to the "Add-on Modules" tab
2. Click "Install Module"
3. In the "Manifest URL" field, paste:
   ```
   https://github.com/yourusername/dnd-beyond-enhanced-importer/releases/download/v1.0.0/module.json
   ```
4. Click "Install"

## Usage

### Setting Up Your Cobalt Cookie

To use this module, you need to provide a Cobalt cookie from your D&D Beyond account:

1. Log in to [D&D Beyond](https://www.dndbeyond.com).
2. Open your browser's Developer Tools (F12 or Ctrl+Shift+I).
3. Go to the Application or Storage tab.
4. Find "Cookies" in the sidebar and select "https://www.dndbeyond.com".
5. Look for a cookie named "CobaltSession" and copy its value.
6. In Foundry VTT, click on the "D&D Beyond" button in the sidebar.
7. Click "Update Cobalt Cookie" and paste your Cobalt cookie in the dialog.

### Importing Content

Once you've set up your Cobalt cookie, you can import content:

1. Click on the "D&D Beyond" button in the sidebar.
2. Select which sources you want to import from.
3. Choose whether to import items, spells, or both.
4. Configure folder options if desired.
5. Click "Import Selected Sources" to start the import process.

## Security Notice

Your Cobalt cookie is stored locally on your Foundry server and is only used to authenticate with D&D Beyond. It is never shared with anyone else. However, cookies can grant access to your D&D Beyond account, so keep your Foundry server secure.

## Legal Notice

This module is not affiliated with, endorsed, sponsored, or approved by Wizards of the Coast or D&D Beyond. This module is intended to be used with content you have legally purchased on D&D Beyond.

## License

This module is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter issues or have suggestions, please file an issue on the [GitHub repository](https://github.com/yourusername/dnd-beyond-enhanced-importer/issues).
