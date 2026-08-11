#!/bin/bash
# ===========================================
# TerraPOS APK Build Script (Capacitor)
# APK akan load dari server (auto-update)
# Native plugins (Bluetooth) tetap berfungsi
# Jalankan di VPS: bash build-apk.sh
# ===========================================

set -e

echo "=== TerraPOS APK Builder ==="

# 1. Set environment
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/root/android-sdk
export PATH=/opt/gradle-8.5/bin:$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0:$PATH

echo "JAVA_HOME: $JAVA_HOME"
echo "ANDROID_HOME: $ANDROID_HOME"
java -version
echo ""

# 2. Install dependencies
echo "=== Installing dependencies... ==="
npm install

# 3. Patch @capacitor/android - force Java 17 (library uses Java 21 by default)
echo "=== Patching @capacitor/android Java version to 17... ==="
find node_modules/@capacitor/android -name "*.gradle" 2>/dev/null | while read f; do
  sed -i 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' "$f"
done
echo "Patch done."

# 4. Build Next.js static export (sebagai fallback offline)
echo "=== Building Next.js (static export for fallback)... ==="
NEXT_OUTPUT=export npx next build

# 5. Copy web assets to Android (fallback jika server unreachable)
echo "=== Syncing web assets to Android... ==="
rm -rf android/app/src/main/assets/public
cp -r out android/app/src/main/assets/public
echo "Web assets copied (fallback)."

# 6. Copy icons to all mipmap folders
echo "=== Syncing app icon... ==="
if [ -f "public/icon-192.png" ]; then
  for density in hdpi mdpi xhdpi xxhdpi xxxhdpi; do
    DIR="android/app/src/main/res/mipmap-${density}"
    mkdir -p "$DIR"
    cp public/icon-192.png "$DIR/ic_launcher.png"
    cp public/icon-192.png "$DIR/ic_launcher_round.png"
    cp public/icon-192.png "$DIR/ic_launcher_foreground.png"
  done
  echo "Icons synced from public/icon-192.png"
fi

# 7. Write capacitor config - POINT TO SERVER (auto-update)
cat > android/app/src/main/assets/capacitor.config.json << 'CAPEOF'
{
  "appId": "com.terrapos.app",
  "appName": "TerraPOS",
  "webDir": "out",
  "server": {
    "url": "${CAPACITOR_SERVER_URL:-https://npos.gtomodachi.fun}",
    "androidScheme": "https",
    "cleartext": false
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 1500,
      "backgroundColor": "#ffffff",
      "showSpinner": false,
      "launchAutoHide": true
    }
  }
}
CAPEOF
echo "Capacitor config written (server mode - auto update)."

# 8. Build APK
echo ""
echo "=== Building APK... ==="
cd android
chmod +x gradlew
./gradlew assembleDebug

# 9. Copy APK to public folder for download
cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk public/terrapos.apk

echo ""
echo "========================================="
echo "BUILD SUCCESSFUL!"
echo ""
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
echo "Download: https://npos.gtomodachi.fun/terrapos.apk"
echo ""
echo "MODE: Server (auto-update)"
echo "APK akan selalu menampilkan versi terbaru dari server."
echo "Native plugins (Bluetooth printer) tetap berfungsi."
echo "========================================="
