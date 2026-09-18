"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Command Center", hint: "Overview" },
  { href: "/spatial", label: "Spatial Intelligence", hint: "GIS" },
  { href: "/network", label: "Food Network", hint: "Graph" },
  { href: "/interventions", label: "Intervention Lab", hint: "Portfolio" },
  { href: "/twin", label: "Digital Twin", hint: "Simulation" },
  { href: "/ai-brief", label: "AI Decision Brief", hint: "Copilot" },
  { href: "/impact", label: "Impact & Responsible AI", hint: "Governance" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>GF</div>
        <div>
          <div className={styles.brandTitle}>GeoAI Food-Resilience</div>
          <div className={styles.brandSubtitle}>Digital Twin</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            >
              <span className={styles.navLabel}>{item.label}</span>
              <span className={styles.navHint}>{item.hint}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerLine}>Hyderabad–Telangana</div>
        <div className={styles.footerLine}>Multi-food · SDG 2</div>
      </div>
    </aside>
  );
}
