import type { Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import OfflineBanner from "@/components/OfflineBanner";
import { ToastProvider } from "@/components/Toast";
import { PrintingOverlayProvider } from "@/components/PrintingOverlay";

export const metadata = {
  title: "TerraPOS",
  description: "POS warkop multi-tenant",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ff7a00",
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
            <OfflineBanner />
            <PWARegister />
            {children}
          </PrintingOverlayProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
