import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.terrapos.app",
  appName: "TerraPOS",
  webDir: "out",
  server: {
    // Load dari server — APK selalu tampilkan versi terbaru tanpa rebuild
    url: "https://npos.gtomodachi.fun",
    androidScheme: "https",
    // Jika server unreachable, Capacitor akan tampilkan error page
    // User bisa retry saat online kembali
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#ffffff",
      showSpinner: false,
      launchAutoHide: true,
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
    // Izinkan WebView load dari server
    allowMixedContent: false,
  },
};

export default config;
