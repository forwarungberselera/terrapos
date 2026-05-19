import type { Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import OfflineBanner from "@/components/OfflineBanner";
import { ToastProvider } from "@/components/Toast";
import { PrintingOverlayProvider } from "@/components/PrintingOverlay";
import MaintenanceGuard from "@/components/MaintenanceGuard";

export const metadata = {
  title: "TerraPOS",
  description: "POS warkop multi-tenant",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#e6739d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        <ToastProvider>
          <PrintingOverlayProvider>
            <MaintenanceGuard>
              <OfflineBanner />
              <PWARegister />
              {children}
            </MaintenanceGuard>
          </PrintingOverlayProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
