#!/bin/bash
# ============================================================
# TerraPOS - Firestore Automated Backup Script
# ============================================================
# Jalankan via cron setiap hari untuk backup Firestore ke GCS
#
# SETUP:
# 1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
# 2. Autentikasi: gcloud auth login
# 3. Buat GCS bucket: gsutil mb gs://terrapos-backups
# 4. Set project: gcloud config set project YOUR_PROJECT_ID
# 5. Tambah ke crontab: crontab -e
#    0 2 * * * /var/www/terrapos/backup-firestore.sh >> /var/log/terrapos-backup.log 2>&1
#
# RESTORE:
# gcloud firestore import gs://terrapos-backups/YYYY-MM-DD
# ============================================================

set -e

# === KONFIGURASI ===
PROJECT_ID="${FIREBASE_PROJECT_ID:-terraposid}"
BUCKET="gs://terrapos-backups"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
RETENTION_DAYS=30

# === WARNA OUTPUT ===
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo " TerraPOS Firestore Backup"
echo " ${TIMESTAMP}"
echo "=========================================="
echo ""

# 1. Cek apakah gcloud tersedia
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}[ERROR] gcloud CLI tidak ditemukan.${NC}"
    echo "Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 2. Cek bucket exists
if ! gsutil ls "${BUCKET}" &> /dev/null; then
    echo -e "${YELLOW}[INFO] Bucket belum ada, membuat ${BUCKET}...${NC}"
    gsutil mb -l asia-southeast2 "${BUCKET}"
    # Set lifecycle: auto-delete setelah RETENTION_DAYS
    cat > /tmp/lifecycle.json << EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": ${RETENTION_DAYS}}
    }
  ]
}
EOF
    gsutil lifecycle set /tmp/lifecycle.json "${BUCKET}"
    rm /tmp/lifecycle.json
    echo -e "${GREEN}[OK] Bucket dibuat dengan retention ${RETENTION_DAYS} hari.${NC}"
fi

# 3. Export Firestore
EXPORT_PATH="${BUCKET}/${DATE}"
echo -e "${YELLOW}[BACKUP] Exporting Firestore ke ${EXPORT_PATH}...${NC}"

gcloud firestore export "${EXPORT_PATH}" \
    --project="${PROJECT_ID}" \
    --async

echo -e "${GREEN}[OK] Export dimulai (async). Cek status:${NC}"
echo "  gcloud firestore operations list --project=${PROJECT_ID}"

# 4. Cleanup: hapus backup lama (> RETENTION_DAYS)
echo ""
echo -e "${YELLOW}[CLEANUP] Menghapus backup lebih dari ${RETENTION_DAYS} hari...${NC}"
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)

# List all date-folders and delete old ones
gsutil ls "${BUCKET}/" 2>/dev/null | while read -r dir; do
    DIR_DATE=$(basename "${dir}" | grep -oP '^\d{4}-\d{2}-\d{2}' || true)
    if [[ -n "${DIR_DATE}" && "${DIR_DATE}" < "${CUTOFF_DATE}" ]]; then
        echo "  Deleting old backup: ${dir}"
        gsutil -m rm -r "${dir}" 2>/dev/null || true
    fi
done

echo ""
echo -e "${GREEN}=========================================="
echo " Backup selesai!"
echo " Export: ${EXPORT_PATH}"
echo " Retention: ${RETENTION_DAYS} hari"
echo "==========================================${NC}"
echo ""
