#!/bin/bash
# ===========================================
# TerraPOS VPS Deploy Script
# Jalankan di VPS: bash deploy.sh
# ===========================================

set -e

APP_DIR="/var/www/terrapos"
WEB_DIR="$APP_DIR/web"
PM2_NAME="terrapos"

echo "🚀 Mulai deploy TerraPOS..."

# Pull latest code
cd "$APP_DIR"
git pull origin main
echo "✅ Git pull selesai"

# Install dependencies & build
cd "$WEB_DIR"
npm install --production
npm run build
echo "✅ Build selesai"

# Restart PM2
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME"
  echo "✅ PM2 restart selesai"
else
  pm2 start npm --name "$PM2_NAME" -- start
  pm2 save
  echo "✅ PM2 start baru selesai"
fi

echo ""
echo "========================================="
echo "✅ Deploy TerraPOS berhasil!"
echo "   Waktu: $(date)"
echo "========================================="
