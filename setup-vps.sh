#!/bin/bash
# ============================================================
# TerraPOS - One-Click VPS Setup
# ============================================================
# Jalankan di VPS baru:
#   curl -fsSL https://raw.githubusercontent.com/forwarungberselera/terrapos/main/setup-vps.sh | bash
#
# ATAU:
#   wget -qO- https://raw.githubusercontent.com/forwarungberselera/terrapos/main/setup-vps.sh | bash
#
# SEBELUM JALANKAN:
# 1. Pastikan domain sudah point ke IP VPS baru
# 2. Siapkan .env.local (Firebase config)
# ============================================================

set -e

DOMAIN="npos.gtomodachi.fun"
APP_DIR="/var/www/terrapos"
REPO="https://github.com/forwarungberselera/terrapos.git"

echo ""
echo "=========================================="
echo "  TerraPOS - Auto Setup VPS"
echo "  Domain: $DOMAIN"
echo "=========================================="
echo ""

# 1. Update system
echo "[1/8] Updating system..."
apt update -y && apt upgrade -y

# 2. Install dependencies
echo "[2/8] Installing dependencies..."
apt install -y git curl nginx certbot python3-certbot-nginx

# 3. Install Node.js 20
echo "[3/8] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# 4. Install PM2
echo "[4/8] Installing PM2..."
npm install -g pm2 2>/dev/null || true

# 5. Clone repo
echo "[5/8] Cloning repository..."
rm -rf $APP_DIR
git clone $REPO $APP_DIR

# 6. Check .env.local
echo "[6/8] Checking .env.local..."
if [ ! -f "$APP_DIR/web/.env.local" ]; then
  echo ""
  echo "  FILE .env.local BELUM ADA!"
  echo "   Buat file: $APP_DIR/web/.env.local"
  echo "   Dengan isi Firebase config kamu."
  echo ""
  echo "   Contoh:"
  echo "   NEXT_PUBLIC_FIREBASE_API_KEY=xxxxx"
  echo "   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxxxx.firebaseapp.com"
  echo "   NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxxxx"
  echo "   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxxxx.appspot.com"
  echo "   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxxxx"
  echo "   NEXT_PUBLIC_FIREBASE_APP_ID=xxxxx"
  echo ""
  echo "   Setelah buat .env.local, jalankan:"
  echo "   cd $APP_DIR/web && npm install && npm run build && cd .. && pm2 start ecosystem.config.js && pm2 save"
  echo ""
  echo "   Lalu setup SSL:"
  echo "   certbot --nginx -d $DOMAIN"
  echo ""
  exit 0
fi

# 7. Build & Start
echo "[7/8] Building & starting app..."
cd $APP_DIR/web
npm install
npm run build
cd $APP_DIR
mkdir -p /var/log/terrapos
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

# 8. Setup Nginx + SSL
echo "[8/8] Setting up Nginx + SSL..."
cat > /etc/nginx/sites-available/terrapos << 'NGINXEOF'
server {
    listen 80;
    server_name npos.gtomodachi.fun;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/terrapos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# SSL
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect 2>/dev/null || {
  echo ""
  echo "  SSL gagal otomatis. Jalankan manual:"
  echo "  certbot --nginx -d $DOMAIN"
}

echo ""
echo "=========================================="
echo "  SETUP SELESAI!"
echo ""
echo "  URL: https://$DOMAIN"
echo "  PM2: pm2 status"
echo "  Logs: pm2 logs terrapos"
echo "=========================================="
echo ""
