# TerraPOS Android (Capacitor Native)

Aplikasi Android native untuk TerraPOS menggunakan Capacitor.
Ini bukan TWA — ini **native app** dengan akses penuh ke Bluetooth.

## Fitur Native

- Bluetooth printer langsung (tanpa Web Bluetooth / RawBT)
- Offline penuh (semua halaman tersimpan di APK)
- Auto-reconnect ke printer terakhir
- Fullscreen (tanpa address bar)
- Bisa publish ke Google Play Store

## Build di VPS

```bash
cd /var/www/terrapos/web
bash build-apk.sh
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

Download dari: `https://npos.gtomodachi.fun/terrapos.apk`

## Build di Komputer (Android Studio)

1. Buka folder `web/android` di Android Studio
2. Tunggu Gradle sync
3. Build > Build APK

## Struktur

```
web/
├── capacitor.config.ts      # Konfigurasi Capacitor
├── build-apk.sh             # Script build APK
├── android/                  # Native Android project (auto-generated)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml  # Permissions (Bluetooth, Internet)
│   │   │   ├── assets/public/       # Web files (dari `out/`)
│   │   │   └── res/                 # Icons, themes
│   │   └── build.gradle
│   └── build.gradle
└── src/lib/
    ├── bluetooth-printer.ts       # Web Bluetooth (fallback browser)
    └── native-bluetooth-printer.ts # Native Bluetooth (Capacitor)
```

## Cara Kerja Bluetooth

1. App detect apakah jalan di native (Capacitor) atau browser
2. Kalau native → pakai `native-bluetooth-printer.ts` (Bluetooth serial langsung)
3. Kalau browser → pakai `bluetooth-printer.ts` (Web Bluetooth API)
4. Printer tersimpan di localStorage, auto-reconnect saat buka app

## Update App

Setiap kali update kode web:
```bash
cd /var/www/terrapos/web
NEXT_OUTPUT=export npx next build
npx cap sync android
cd android && ./gradlew assembleDebug
```
