#!/bin/bash
# ===========================================
# TerraPOS VPS Initial Setup
# Jalankan SEKALI di VPS baru: bash setup-vps.sh
# ===========================================

set -e

echo "🔧 Setup TerraPOS di VPS..."

# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt install -y nodejs
fi
echo "✅ Node.js $(node -v)"

# 3. Install PM2
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
fi
echo "✅ PM2 installed"

# 4. Install Nginx
if ! command -v nginx &> /dev/null; then
  echo "📦 Installing Nginx..."
  sudo apt install -y nginx
fi
echo "✅ Nginx installed"

# 5. Clone repo
APP_DIR="/var/www/terrapos"
if [ ! -d "$APP_DIR" ]; then
  echo "📥 Cloning repository..."
  sudo mkdir -p /var/www
  sudo chown $USER:$USER /var/www
  git clone https://github.com/forwarungberselera/terrapos.git "$APP_DIR"
fi
echo "✅ Repository ready at $APP_DIR"

# 6. Setup web
cd "$APP_DIR/web"

# Create .env.local template if not exists
if [ ! -f .env.local ]; then
  cat > .env.local << 'EOF'
NEXT_PUBLIC_FIREBASE_API_KEY=ISI_DISINI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ISI_DISINI
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ISI_DISINI
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ISI_DISINI
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=ISI_DISINI
NEXT_PUBLIC_FIREBASE_APP_ID=ISI_DISINI
EOF
  echo ""
  echo "⚠️  PENTING: Edit file .env.local dengan Firebase config kamu!"
  echo "   nano $APP_DIR/web/.env.local"
  echo ""
fi

# 7. Install & Build
npm install
echo ""
echo "⚠️  Sebelum build, pastikan .env.local sudah diisi!"
echo "   Lalu jalankan:"
echo "   cd $APP_DIR/web && npm run build"
echo ""

# 8. Setup PM2 startup
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

# 9. Setup Nginx config
NGINX_CONF="/etc/nginx/sites-available/terrapos"
if [ ! -f "$NGINX_CONF" ]; then
  sudo tee "$NGINX_CONF" > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;  # Ganti dengan domain kamu

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
  sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/terrapos
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl restart nginx
  echo "✅ Nginx configured"
fi

echo ""
echo "========================================="
echo "✅ Setup VPS selesai!"
echo ""
echo "LANGKAH SELANJUTNYA:"
echo "1. Edit .env.local:"
echo "   nano $APP_DIR/web/.env.local"
echo ""
echo "2. Build & Start:"
echo "   cd $APP_DIR/web"
echo "   npm run build"
echo "   pm2 start npm --name terrapos -- start"
echo "   pm2 save"
echo ""
echo "3. (Opsional) Setup SSL:"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d domain-kamu.com"
echo ""
echo "4. (Opsional) Edit domain di Nginx:"
echo "   sudo nano /etc/nginx/sites-available/terrapos"
echo "========================================="
