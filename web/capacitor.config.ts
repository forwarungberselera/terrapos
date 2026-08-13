import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.terrapos.app",
  appName: "TerraPOS",
  webDir: "out",
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
