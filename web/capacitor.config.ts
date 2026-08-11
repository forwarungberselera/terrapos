import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.terrapos.app",
  appName: "TerraPOS",
  webDir: "out",
  server: {
    // Load dari Vercel server — APK selalu menampilkan versi terbaru secara otomatis
    url: process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "https://terrapos.web.id/",
    androidScheme: "https",
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
