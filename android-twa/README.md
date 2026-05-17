# TerraPOS Android (TWA)

Aplikasi Android untuk TerraPOS menggunakan Trusted Web Activity (TWA).

## Cara Build APK

### Opsi 1: Pakai Android Studio (Recommended)

1. Download [Android Studio](https://developer.android.com/studio)
2. Buka folder `android-twa` di Android Studio
3. Tunggu Gradle sync selesai
4. Klik **Build → Build Bundle(s) / APK(s) → Build APK(s)**
5. APK ada di `app/build/outputs/apk/release/`

### Opsi 2: Build via Command Line

```bash
cd android-twa
chmod +x gradlew
./gradlew assembleRelease
```

APK output: `app/build/outputs/apk/release/app-release-unsigned.apk`

### Sign APK (untuk publish ke Play Store)

```bash
# Generate keystore (sekali saja)
keytool -genkey -v -keystore terrapos.keystore -alias terrapos -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore terrapos.keystore app/build/outputs/apk/release/app-release-unsigned.apk terrapos

# Align APK
zipalign -v 4 app/build/outputs/apk/release/app-release-unsigned.apk terrapos.apk
```

## Digital Asset Links (Penting!)

Agar TWA berjalan fullscreen (tanpa address bar), tambahkan file ini di VPS:

**File:** `/var/www/terrapos/web/public/.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.terrapos.app",
    "sha256_cert_fingerprints": ["FINGERPRINT_SHA256_KAMU"]
  }
}]
```

Untuk mendapatkan SHA256 fingerprint:
```bash
keytool -list -v -keystore terrapos.keystore -alias terrapos | grep SHA256
```

## Struktur

```
android-twa/
├── app/
│   ├── build.gradle          # Config app + TWA
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/.../LauncherActivity.java
│       └── res/
│           └── values/
│               ├── strings.xml
│               └── styles.xml
├── build.gradle              # Root build config
├── gradle.properties
├── gradle/wrapper/
│   └── gradle-wrapper.properties
└── settings.gradle
```

## Catatan

- Min SDK: Android 7.0 (API 24)
- Target SDK: Android 14 (API 34)
- TWA membuka website PWA langsung fullscreen, tanpa browser bar
- Update otomatis karena konten dari web (tidak perlu publish ulang ke Play Store)
