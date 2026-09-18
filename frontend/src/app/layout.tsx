import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { getHealth } from "@/lib/api";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GeoAI Food-Resilience Digital Twin",
  description:
    "Decision-intelligence platform for the Hyderabad–Telangana multi-food system: GIS, risk, food network, interventions, and digital twin simulation.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const health = await getHealth();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="app-main">
            <TopBar backendReachable={health !== null} />
            <main className="app-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
