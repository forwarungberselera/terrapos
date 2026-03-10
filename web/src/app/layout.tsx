import "./globals.css";
import PWARegister from "@/components/PWARegister";
import OfflineBanner from "@/components/OfflineBanner";

export const metadata = {
  title: "TerraPOS",
  description: "POS warkop multi-tenant",
  manifest: "/manifest.json",
  themeColor: "#ff7a00",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
	    <OfflineBanner />
        <PWARegister />
        {children}
      </body>
    </html>
  );
}