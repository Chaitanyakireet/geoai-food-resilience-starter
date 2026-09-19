"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const ICON_PROPS = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const NAV_ITEMS = [
  {
    href: "/",
    label: "Command Center",
    hint: "Overview",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 12l4.2-6.2L12 8.4 7.8 5.8 12 12z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/spatial",
    label: "Spatial Intelligence",
    hint: "GIS",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4z" />
        <path d="M9 4v14M15 6.5v14" />
      </svg>
    ),
  },
  {
    href: "/network",
    label: "Food Network",
    hint: "Graph",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="5" cy="6" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <circle cx="12" cy="13" r="2.2" />
        <circle cx="5" cy="20" r="2.2" />
        <circle cx="19" cy="20" r="2.2" />
        <path d="M6.7 7.3 10.3 11.6M17.3 7.3 13.7 11.6M10.3 14.5 6.7 18.7M13.7 14.5 17.3 18.7" />
      </svg>
    ),
  },
  {
    href: "/interventions",
    label: "Intervention Lab",
    hint: "Portfolio",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M6 3v6l-3 9a2 2 0 0 0 2 2.6h14a2 2 0 0 0 2-2.6l-3-9V3" />
        <path d="M6 3h6M9 14h.01" />
      </svg>
    ),
  },
  {
    href: "/twin",
    label: "Digital Twin",
    hint: "Simulation",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="8" height="8" rx="1.5" />
        <rect x="13" y="12" width="8" height="8" rx="1.5" />
        <path d="M11 8h4a2 2 0 0 1 2 2v2M13 16H9a2 2 0 0 1-2-2v-2" />
      </svg>
    ),
  },
  {
    href: "/ai-brief",
    label: "AI Decision Brief",
    hint: "Copilot",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3l1.8 4.6L18 9l-4.2 1.9L12 15l-1.8-4.1L6 9l4.2-1.4L12 3z" />
        <path d="M5 17l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8L5 17z" />
      </svg>
    ),
  },
  {
    href: "/impact",
    label: "Impact & Responsible AI",
    hint: "Governance",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Image
          src="/geoai-food-resilience-logo.png"
          alt="GeoAI Food-Resilience Digital Twin"
          width={1659}
          height={948}
          className={styles.brandLogo}
          unoptimized
          priority
        />
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
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navText}>
                <span className={styles.navLabel}>{item.label}</span>
                <span className={styles.navHint}>{item.hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.identityPanel}>
        <Image
          src="/sidebar/hussain-sagar-buddha-sunset.jpg"
          alt="The Buddha statue at Hussain Sagar, Hyderabad, at sunset"
          fill
          sizes="220px"
          className={styles.identityImage}
          unoptimized
        />
        <div className={styles.identityGradient} aria-hidden />
        <div className={styles.identityText}>
          <div className={styles.identityHeadline}>
            A Resilient
            <br />
            Food Future
            <br />
            for <span className={styles.identityAccent}>Telangana</span>
          </div>
          <div className={styles.identityTagline}>Spatial Intelligence · Food · Climate · Resilience</div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerLine}>Hyderabad–Telangana · Multi-food · SDG 2</div>
        <div className={styles.photoCredit}>
          Hussain Sagar, Hyderabad — Lakshayreddy,{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:Sunset_at_Hussain_Sagar.jpg"
            target="_blank"
            rel="noreferrer"
            className={styles.photoCreditLink}
          >
            Wikimedia Commons
          </a>
          , CC BY-SA 3.0
        </div>
      </div>
    </aside>
  );
}
