/**
 * ============================================================
 * TerraPOS - PM2 Ecosystem Configuration
 * ============================================================
 * 
 * PENGGUNAAN:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js   (zero-downtime restart)
 *   pm2 stop terrapos
 *   pm2 delete terrapos
 *   pm2 logs terrapos
 *   pm2 monit
 *
 * SETUP PERTAMA KALI:
 *   1. cd /var/www/terrapos/web
 *   2. npm run build
 *   3. cd /var/www/terrapos
 *   4. pm2 start ecosystem.config.js
 *   5. pm2 save
 *   6. pm2 startup  (agar auto-start saat reboot)
 *
 * DEPLOY (zero-downtime):
 *   cd /var/www/terrapos && git pull origin main && cd web && npm run build && cd .. && pm2 reload ecosystem.config.js
 *
 * ============================================================
 */

module.exports = {
  apps: [
    {
      name: "terrapos",

      // === COMMAND ===
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/var/www/terrapos/web",

      // === CLUSTER MODE ===
      // "max" = gunakan semua CPU core (4 core = 4 instance)
      // Untuk VPS 8GB RAM, 4 core: "max" aman
      // Jika mau hemat RAM, set ke 2
      instances: "max",
      exec_mode: "cluster",

      // === MEMORY & RESTART ===
      // Restart otomatis jika instance pakai >512MB RAM
      max_memory_restart: "512M",

      // === AUTO RESTART ===
      autorestart: true,
      watch: false, // Jangan watch di production!
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,

      // === ENVIRONMENT ===
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // === LOGGING ===
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/terrapos/error.log",
      out_file: "/var/log/terrapos/out.log",
      merge_logs: true,
      log_type: "json",

      // === GRACEFUL SHUTDOWN ===
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,

      // === HEALTH CHECK ===
      // PM2 akan cek apakah app masih responsif
      // Jika tidak, auto-restart
      exp_backoff_restart_delay: 100,
    },
  ],

  // === DEPLOY CONFIG (opsional, untuk pm2 deploy) ===
  deploy: {
    production: {
      user: "root",
      host: "YOUR_VPS_IP",
      ref: "origin/main",
      repo: "git@github.com:forwarungberselera/terrapos.git",
      path: "/var/www/terrapos",
      "pre-deploy": "git fetch --all",
      "post-deploy":
        "cd web && npm install && npm run build && cd .. && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "mkdir -p /var/log/terrapos",
    },
  },
};
