# D&D Beyond Foundry Proxy Server

This is a companion proxy server for the **D&D Beyond Enhanced Importer** Foundry VTT module. It runs alongside Foundry to bypass browser CORS restrictions and enable importing your personal D&D Beyond content.

## Why Do I Need This?

Browsers block direct requests from Foundry to D&D Beyond (CORS security). This tiny server runs on your computer and acts as a "translator" between Foundry and D&D Beyond, allowing you to import your purchased content automatically.

## Quick Start

### Option 1: Use Pre-built Executable (Easiest)

1. Download the appropriate file for your system from the [Releases](../../releases) page:
   - **Windows**: `ddb-proxy-windows.exe`
   - **Mac**: `ddb-proxy-macos`
   - **Linux**: `ddb-proxy-linux`

2. Double-click the file to run it

3. You should see:
   ```
   ╔══════════════════════════════════════════════════════╗
   ║   D&D Beyond Foundry Proxy Server                   ║
   ╚══════════════════════════════════════════════════════╝

   ✓ Server running on http://localhost:3001
   ✓ Health check: http://localhost:3001/health
   ✓ Ready to proxy requests to D&D Beyond
   ```

4. Leave this window open and use Foundry normally!

### Option 2: Run with Node.js (Developers)

**Requirements**: Node.js 18 or higher

1. Navigate to this directory:
   ```bash
   cd proxy-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

## Usage

1. **Start the proxy server** (leave it running)
2. **Start Foundry VTT**
3. **Open your world**
4. **Click "Import D&D Beyond"** in the sidebar
5. Your content will now import automatically!

## Configuration

By default, the proxy runs on port **3001**. To change this:

```bash
PORT=3002 npm start
```

Or set the `PORT` environment variable on Windows/Mac.

## Troubleshooting

### Port Already in Use

If port 3001 is already taken:
1. Close other applications using that port
2. Or change the port (see Configuration above)
3. Update the port in Foundry module settings

### Firewall Blocking

If your firewall blocks the connection:
1. Allow the proxy server through your firewall
2. The proxy only listens on `localhost` (not accessible from internet)

### Still Not Working?

1. Check that the proxy is running (green text in terminal)
2. Visit http://localhost:3001/health in your browser
3. You should see: `{"status":"ok",...}`
4. Check Foundry's F12 console for errors

## Security

- ✅ **Runs locally** - Only on your computer
- ✅ **No internet exposure** - Only listens on localhost
- ✅ **Your cookie stays private** - Never sent anywhere except D&D Beyond
- ✅ **Open source** - Audit the code yourself!

## Building from Source

To create executables for distribution:

```bash
npm install
npm run build:all
```

This creates executables in the `dist/` folder for Windows, Mac, and Linux.

## Auto-Start on Boot (Optional)

### Windows
1. Press `Win+R`, type `shell:startup`
2. Create a shortcut to `ddb-proxy-windows.exe` in that folder

### Mac
1. Go to **System Preferences** → **Users & Groups** → **Login Items**
2. Click `+` and add `ddb-proxy-macos`

### Linux (systemd)
Create `/etc/systemd/system/ddb-proxy.service`:
```ini
[Unit]
Description=D&D Beyond Foundry Proxy
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
ExecStart=/path/to/ddb-proxy-linux
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable ddb-proxy
sudo systemctl start ddb-proxy
```

## License

MIT License - See main module LICENSE file

## Support

For issues, visit: https://github.com/ogregod/Enhanced-Importer/issues
