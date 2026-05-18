#!/bin/bash
# ===========================================
# TerraPOS APK Build Script (Capacitor)
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

# 2. Build Next.js static export
echo ""
echo "=== Building Next.js (static export)... ==="
NEXT_OUTPUT=export npx next build

# 3. Copy web assets ke Android (manual sync tanpa cap CLI)
echo ""
echo "=== Syncing web assets to Android... ==="
rm -rf android/app/src/main/assets/public
cp -r out android/app/src/main/assets/public

# Copy icon dari web ke semua mipmap folders
echo "=== Syncing app icon... ==="
if [ -f "public/icon-192.png" ]; then
  cp public/icon-192.png android/app/src/main/res/mipmap-hdpi/ic_launcher.png
  cp public/icon-192.png android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
  cp public/icon-192.png android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png
  cp public/icon-192.png android/app/src/main/res/mipmap-mdpi/ic_launcher.png
  cp public/icon-192.png android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
  cp public/icon-192.png android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
  cp public/icon-192.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png
  echo "Icon synced from public/icon-192.png"
fi

# Copy capacitor config
cat > android/app/src/main/assets/capacitor.config.json << 'EOF'
{
  "appId": "com.terrapos.app",
  "appName": "TerraPOS",
  "webDir": "out",
  "server": {
    "androidScheme": "https"
  }
}
EOF

# 4. Patch plugin namespace (capacitor-bluetooth-serial tidak punya namespace)
echo ""
echo "=== Patching capacitor-bluetooth-serial namespace... ==="
BT_BUILD="../node_modules/capacitor-bluetooth-serial/android/build.gradle"
if [ -f "$BT_BUILD" ]; then
  if ! grep -q "^namespace" "$BT_BUILD" && ! grep -q "namespace " "$BT_BUILD"; then
    # Tambahkan namespace setelah baris "android {"
    sed -i 's/^android {/android {\n    namespace "com.bluetoothserial"/' "$BT_BUILD"
    echo "Namespace patched: $BT_BUILD"
  else
    echo "Namespace already exists, skip."
  fi
fi

# 4b. Patch compileOptions ke Java 17
echo "=== Patching Java version to 17... ==="
sed -i 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' android/app/capacitor.build.gradle
echo "Java version patched."

# 5. Build APK
echo ""
echo "=== Building APK... ==="
cd android
chmod +x gradlew
./gradlew assembleDebug

# 5. Copy APK to public folder
echo ""
echo "=== Copying APK... ==="
cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk public/terrapos.apk

echo ""
echo "========================================="
echo "BUILD SUCCESSFUL!"
echo ""
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
echo "Download: https://npos.gtomodachi.fun/terrapos.apk"
echo "========================================="
