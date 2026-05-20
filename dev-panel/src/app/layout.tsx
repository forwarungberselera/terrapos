import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "TerraPOS Developer Panel",
  description: "Internal developer dashboard for TerraPOS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthGuard>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
