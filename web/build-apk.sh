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

# 3. Sync Capacitor
echo ""
echo "=== Syncing Capacitor... ==="
npx cap sync android

# 4. Build APK
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
