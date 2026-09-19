import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { getAiProvenance, getDistricts, getHealth } from "@/lib/api";
import "leaflet/dist/leaflet.css";
import "./globals.css";

// Three coordinated families for a deliberate, scientific-instrument feel:
// Space Grotesk carries display weight (product name, page/section titles,
// large metrics), IBM Plex Sans carries UI/body text, and IBM Plex Mono
// carries data-grade text (IDs, coordinates, provenance, truth status).
const displayFont = Space_Grotesk({
  variable: "--font-display-raw",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sansFont = IBM_Plex_Sans({
  variable: "--font-sans-raw",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono-raw",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "GeoAI Food-Resilience Digital Twin",
  description:
    "Decision-intelligence platform for the Hyderabad–Telangana multi-food system: GIS, risk, food network, interventions, and digital twin simulation.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [health, districts, aiProvenance] = await Promise.all([getHealth(), getDistricts(), getAiProvenance()]);

  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}>
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="app-main">
            <TopBar backendReachable={health !== null} districts={districts} aiConfigured={aiProvenance?.provider.configured ?? null} />
            <main className="app-content">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
