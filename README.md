# D&D Beyond Enhanced Importer for Foundry VTT

Import all your purchased D&D Beyond content directly into Foundry VTT with full functionality. Items and spells come properly configured with pricing, templates, effects, and rolls.

![Version](https://img.shields.io/badge/version-1.0.119-blue)
![Foundry](https://img.shields.io/badge/Foundry-v11--v13-orange)
![System](https://img.shields.io/badge/System-D&D%205e-red)

---

## ✨ Features

- ✅ **Import Personal Content** - Access everything you own on D&D Beyond
- ✅ **Hosted Proxy Included** - Pre-configured cloud proxy, no downloads required
- ✅ **Automatic Organization** - Organize by sourcebook or item type
- ✅ **Homebrew Support** - Import custom homebrew content
- ✅ **Progress Tracking** - Visual progress bars for large imports
- ✅ **Smart Caching** - Fast repeat imports
- ✅ **Local Fallback** - Works offline with pre-loaded SRD content

---

## 🚀 Quick Start

### Step 1: Install the Module

1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Paste this URL into the Manifest URL field:
   ```
   https://raw.githubusercontent.com/ogregod/Enhanced-Importer/main/module.json
   ```
4. Click **Install**

### Step 2: Get Your Cobalt Cookie

1. Go to [D&D Beyond](https://www.dndbeyond.com) and log in
2. Press **F12** to open Developer Tools
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Click **Cookies** → `https://www.dndbeyond.com`
5. Find **CobaltSession** and copy its value

### Step 3: Start the Proxy Server

**Option A: Run Locally (Recommended for Testing)**
```bash
cd proxy-server
npm install
npm start
```
The proxy will start on `http://localhost:3001` and the module will automatically detect it.

**Option B: Deploy to Render/Railway (Recommended for Production)**
See [proxy-server/DEPLOYMENT.md](proxy-server/DEPLOYMENT.md) for detailed deployment instructions.

### Step 4: Configure & Import

1. **Activate the module** in your Foundry world
2. Go to **Settings** → **Module Settings** → **D&D Beyond Enhanced Importer**
3. Paste your **Cobalt Cookie**
4. (Optional) Set **Proxy Server URL** if not using localhost
5. Click the **"Import D&D Beyond"** button in the sidebar
6. Select sources and click **Import**!

---

## 📖 Usage

### Import Dialog

Click **"Import D&D Beyond"** in the Items sidebar to open the import dialog.

**Official Content Tab:**
- Select which sourcebooks to import from
- Choose items and/or spells
- Configure folder organization
- Set overwrite behavior

**Homebrew Tab:**
- Enter D&D Beyond homebrew URL
- Import custom items and spells

### Import Options

| Option | Description |
|--------|-------------|
| **Import Items** | Include equipment, weapons, armor, etc. |
| **Import Spells** | Include all spell types |
| **Create Folders** | Organize imports into folders |
| **Folder Structure** | By Source Book, By Item Type, or Flat |
| **Overwrite Existing** | Update items if they already exist |

---

## 🔧 How It Works

```
┌─────────────────────────────────────────┐
│         Your Computer                   │
│                                         │
│  ┌──────────────┐                      │
│  │ Foundry VTT  │ :30000               │
│  └──────┬───────┘                      │
│         │                               │
│         ↓ talks to                      │
│  ┌──────────────┐                      │
│  │ Proxy Server │ :3001                │
│  └──────┬───────┘                      │
│         │                               │
└─────────┼───────────────────────────────┘
          │
          ↓ talks to (no CORS!)
   ┌──────────────┐
   │ D&D Beyond   │
   └──────────────┘
```

1. **Foundry module** sends request to proxy (localhost - no CORS)
2. **Proxy server** forwards to D&D Beyond with your cookie
3. **D&D Beyond** returns your content
4. **Proxy** sends it back to Foundry
5. **Module** converts and imports into your world

---

## ❓ FAQ

### Do I need to keep the proxy running?

Yes, while importing. You can close it afterward and reopen it when you want to import again.

### Can I auto-start the proxy?

Yes! See [proxy-server/README.md](proxy-server/README.md) for instructions on auto-starting on boot.

### What if the proxy isn't running?

The module automatically falls back to its local database with SRD content. You just won't get your personal purchased items.

### Is my Cobalt cookie secure?

Yes. It's stored locally in Foundry's database and only sent to:
1. The proxy running on your computer (localhost)
2. D&D Beyond's API

It's never sent to any third-party servers.

### Can I use this without the proxy?

Yes, but you'll only have access to the pre-loaded SRD content in the local database. To import your personal D&D Beyond content, you need the proxy.

---

## 🛠️ Development

### Building the Proxy

```bash
cd proxy-server
npm install
npm run build:all
```

This creates executables in `proxy-server/dist/` for all platforms.

### Module Development

```bash
npm install
```

The module uses ES6 modules and is compatible with Foundry VTT v11-v13.

---

## 📝 Changelog

### v1.0.107 (Latest)
- ✅ Added configurable proxy URL setting
- ✅ Support for hosted proxy servers (Railway, Render, etc.)
- ✅ Dynamic proxy URL configuration instead of hardcoded localhost
- ✅ Settings integration for proxy URL management

### v1.0.106
- ✅ Added proxy server for live D&D Beyond API access
- ✅ Automatic proxy detection and fallback
- ✅ Improved error handling and user messages
- ✅ Cookie validation through proxy

### v1.0.105
- ✅ Fixed ApplicationV2 compatibility
- ✅ Fixed tab navigation
- ✅ Improved CORS handling

### v1.0.4
- ✅ Registered missing Handlebars helpers

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- D&D Beyond for their amazing platform
- Foundry VTT community for inspiration
- D&D 5e system developers

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/ogregod/Enhanced-Importer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ogregod/Enhanced-Importer/discussions)

---

**Made with ❤️ for the Foundry VTT community**
