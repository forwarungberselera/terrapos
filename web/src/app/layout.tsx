import type { Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import OfflineBanner from "@/components/OfflineBanner";
import BrandColorProvider from "@/components/BrandColorProvider";
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
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Preconnect to font CDNs for faster loading */}
        <link rel="preconnect" href="https://db.onlinewebfonts.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inline script to prevent dark mode flash (FOUC) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("terrapos_theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ToastProvider>
          <PrintingOverlayProvider>
            <MaintenanceGuard>
              <BrandColorProvider />
              <Suspense fallback={null}>
                <OfflineBanner />
                <PWARegister />
              </Suspense>
              {children}
            </MaintenanceGuard>
          </PrintingOverlayProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
