# Deployment Guide for D&D Beyond Proxy Server

This guide will help you deploy the proxy server to a hosting platform. Choose the option that works best for you.

---

## 🚀 **Option 1: Railway.app (Recommended - Easiest)**

**Cost:** Free tier available ($5/month for better performance)
**Deployment Time:** 5 minutes
**Difficulty:** ⭐ Easy

### Steps:

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Deploy from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `Enhanced-Importer` repository
   - Select the `proxy-server` directory as the root

3. **Configure**
   - Railway auto-detects Node.js
   - Set environment variable: `NODE_ENV=production`
   - Railway will automatically assign a public URL

4. **Get Your Proxy URL**
   - After deployment, Railway shows your URL
   - Example: `https://ddb-proxy-production.up.railway.app`
   - **Copy this URL** - you'll need it for the module settings

5. **Update Module Settings**
   - In Foundry, go to Module Settings
   - Set "Proxy Server URL" to your Railway URL
   - Save

### Cost Estimate:
- **Free tier**: 500 hours/month (~$0)
- **Pro tier**: $5/month (better performance, no limits)

---

## 🚀 **Option 2: Render.com (Free Forever)**

**Cost:** Free (with auto-sleep after 15min inactivity)
**Deployment Time:** 10 minutes
**Difficulty:** ⭐ Easy

### Steps:

1. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Deploy**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Root Directory: `proxy-server`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Configure**
   - Set Environment Variable:
     - `NODE_ENV` = `production`
   - Free tier includes automatic HTTPS

4. **Note About Free Tier**
   - Service sleeps after 15min of inactivity
   - First request after sleep takes ~30 seconds
   - Upgrade to paid ($7/month) for always-on

5. **Get Your URL**
   - Render provides URL like: `https://ddb-proxy.onrender.com`
   - Copy and use in module settings

---

## 🚀 **Option 3: Docker (Any Platform)**

**Cost:** Varies by provider
**Deployment Time:** 15-30 minutes
**Difficulty:** ⭐⭐ Moderate

### Platforms that support Docker:
- **DigitalOcean App Platform** ($5/month)
- **AWS Elastic Container Service** (~$10/month)
- **Google Cloud Run** (Pay per use, ~$2-5/month)
- **Azure Container Instances** (~$5-10/month)

### Build and Push:

```bash
cd proxy-server

# Build image
docker build -t ddb-proxy:latest .

# Test locally
docker run -p 3001:3001 -e NODE_ENV=production ddb-proxy:latest

# Visit http://localhost:3001/health to verify

# Tag for your registry (example using Docker Hub)
docker tag ddb-proxy:latest yourusername/ddb-proxy:latest

# Push to registry
docker push yourusername/ddb-proxy:latest
```

### Deploy to DigitalOcean (Example):

1. Create account at https://www.digitalocean.com
2. Go to "App Platform"
3. Create new app from Docker Hub
4. Enter your image: `yourusername/ddb-proxy:latest`
5. Set PORT to 3001
6. Set `NODE_ENV=production`
7. Deploy

---

## 🚀 **Option 4: Manual VPS (Advanced)**

**Cost:** $4-10/month
**Deployment Time:** 30-60 minutes
**Difficulty:** ⭐⭐⭐ Advanced

### Platforms:
- **DigitalOcean Droplet** ($4/month)
- **Linode** ($5/month)
- **Vultr** ($5/month)
- **AWS EC2 t3.micro** (~$8/month)

### Setup (Ubuntu 22.04):

```bash
# SSH into your server
ssh root@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Clone your repository
git clone https://github.com/yourusername/Enhanced-Importer.git
cd Enhanced-Importer/proxy-server

# Install dependencies
npm install --production

# Start with PM2
NODE_ENV=production pm2 start server.js --name ddb-proxy

# Save PM2 configuration
pm2 save
pm2 startup

# Install Nginx for reverse proxy
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Configure Nginx (create /etc/nginx/sites-available/ddb-proxy)
sudo nano /etc/nginx/sites-available/ddb-proxy
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ddb-proxy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get free SSL certificate
sudo certbot --nginx -d your-domain.com

# Your proxy is now at: https://your-domain.com
```

---

## 📊 **Cost Comparison**

| Platform | Free Tier | Paid | Ease | Best For |
|----------|-----------|------|------|----------|
| **Railway** | 500hrs/mo | $5/mo | ⭐⭐⭐ | Quick setup |
| **Render** | Yes (sleeps) | $7/mo | ⭐⭐⭐ | Free forever |
| **Docker+DO** | No | $5/mo | ⭐⭐ | Docker fans |
| **Manual VPS** | No | $4-10/mo | ⭐ | Full control |

---

## 🔒 **Security Checklist**

After deployment, verify:

- ✅ HTTPS is enabled (most platforms do this automatically)
- ✅ Visit `/health` endpoint - should return `{"status":"ok"}`
- ✅ Rate limiting is active (try 101 requests in 15min - should get blocked)
- ✅ Logs don't show Cobalt cookies (check platform logs)
- ✅ Only necessary ports are exposed (just HTTP/HTTPS)

---

## 📈 **Monitoring**

### Check if your proxy is working:

```bash
# Health check
curl https://your-proxy-url.com/health

# Should return:
# {"status":"ok","version":"1.0.106",...}
```

### Set up uptime monitoring (optional):

Free services:
- **UptimeRobot** - https://uptimerobot.com (free)
- **Pingdom** - https://www.pingdom.com (free tier)
- **StatusCake** - https://www.statuscake.com (free tier)

Configure to ping `/health` every 5 minutes.

---

## 🆘 **Troubleshooting**

### "Service Unavailable"
- Check platform logs for errors
- Verify `NODE_ENV=production` is set
- Ensure port matches platform expectations

### "CORS Error" in Foundry
- Verify proxy URL is correct in module settings
- Check proxy logs for blocked requests
- Ensure HTTPS (not HTTP) if Foundry uses HTTPS

### "Rate Limited"
- Normal behavior after 100 requests in 15min per IP
- Consider upgrading server if hit often
- Or adjust rate limit in `server.js`

### "Timeout Errors"
- D&D Beyond might be slow - normal
- Check proxy server resources (CPU/memory)
- Consider upgrading server tier

---

## 🔄 **Updating the Proxy**

When you update the code:

### Railway/Render:
```bash
git push origin main
# Auto-deploys!
```

### Docker:
```bash
docker build -t ddb-proxy:latest .
docker push yourusername/ddb-proxy:latest
# Platform will pull new image
```

### Manual VPS:
```bash
ssh root@your-server
cd Enhanced-Importer/proxy-server
git pull
npm install --production
pm2 restart ddb-proxy
```

---

## 💰 **Recommended Setup for Production**

**For small user base (<100 users):**
- **Railway Free Tier** - Start here, upgrade if needed

**For medium user base (100-1000 users):**
- **Railway Pro** ($5/mo) or **Render Starter** ($7/mo)

**For large user base (1000+ users):**
- **DigitalOcean App Platform** ($10/mo) with auto-scaling
- Or **AWS/GCP** with load balancing

---

## 📝 **After Deployment**

1. **Update Module Settings**
   - Your proxy URL goes in the module's proxy setting
   - Test by importing a character

2. **Share with Users**
   - Users just install the module
   - They enter their Cobalt cookie
   - Everything works automatically!

3. **Monitor Usage**
   - Check platform dashboards weekly
   - Watch for errors or high traffic
   - Upgrade if needed

---

## ✅ **Quick Start (Railway - Recommended)**

**TL;DR for fastest deployment:**

1. Sign up: https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Select your repo, `proxy-server` folder
4. Set `NODE_ENV=production`
5. Copy the URL Railway gives you
6. Put URL in Foundry module settings
7. Done! 🎉

**Time:** 5 minutes
**Cost:** Free (or $5/mo for Pro)

---

Need help? Open an issue on GitHub!
