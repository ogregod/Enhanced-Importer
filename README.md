# D&D Beyond Enhanced Importer

A Foundry VTT module for importing content from D&D Beyond. Import all your purchased D&D Beyond content with enhanced functionality. All items and spells will be properly configured with correct pricing, templates, effects, and rolls.

## Features

- Import items and spells from your purchased D&D Beyond content
- Organize imported content in folders by source book or item type
- Import homebrew content from D&D Beyond
- Compatible with Foundry VTT v11 and v13

## Installation

1. In Foundry VTT, go to "Add-on Modules"
2. Click "Install Module"
3. Paste the following URL into the "Manifest URL" field:
   ```
   https://raw.githubusercontent.com/ogregod/Enhanced-Importer/main/module.json
   ```
4. Click "Install"

## Usage

1. Activate the module in your game world
2. Configure your D&D Beyond Cobalt cookie in the module settings
3. Click the "Import D&D Beyond" button in the sidebar
4. Select which sources to import from
5. Configure the import options and click "Import"

## Known Limitations

Due to browser security restrictions (CORS), direct API access to D&D Beyond may be limited. The module will use its local database for imports in these cases. For full API access, consider setting up a proxy server.

## License

This module is licensed under the MIT License. See the LICENSE file for details.