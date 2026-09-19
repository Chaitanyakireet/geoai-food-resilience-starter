"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DistrictsFeatureCollection } from "@/lib/api";
import { LOCALITY_ALIASES } from "@/lib/localityAliases";
import styles from "./TopBarSearch.module.css";

type Match = { label: string; sublabel: string; href: string };

// A real, working global search rather than a decorative input: it only
// indexes what's genuinely available from anywhere in the app without an
// extra fetch -- the 33 districts (always loaded) and the same short,
// verified locality-alias list Spatial Intelligence's own search uses
// (Hitech City, Gachibowli, ...). It does not index all 593 mandals here
// (those load lazily per-district inside Spatial Intelligence itself);
// selecting a result navigates there and lets it finish the job.
export function TopBarSearch({ districts }: { districts: DistrictsFeatureCollection | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo<Match[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !districts) return [];

    const districtMatches: Match[] = districts.features
      .filter((f) => f.properties.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((f) => ({ label: f.properties.name, sublabel: "District", href: `/spatial?district=${f.properties.district_id}` }));

    const aliasMatches: Match[] = LOCALITY_ALIASES.filter((a) => a.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((a) => ({
        label: a.name,
        sublabel: "Locality (Spatial Intelligence)",
        href: `/spatial?mandal=${a.districtId}::${a.mandalId}`,
      }));

    return [...districtMatches, ...aliasMatches];
  }, [query, districts]);

  const handleSelect = (m: Match) => {
    setQuery("");
    setOpen(false);
    router.push(m.href);
  };

  return (
    <div className={styles.wrap}>
      <svg className={styles.icon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        className={styles.input}
        type="text"
        placeholder={districts ? "Search district or food-system place…" : "Search unavailable — GIS service down"}
        value={query}
        disabled={!districts}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 ? (
        <ul className={styles.results}>
          {matches.map((m) => (
            <li key={`${m.label}-${m.href}`}>
              <button type="button" className={styles.result} onMouseDown={() => handleSelect(m)}>
                <span>{m.label}</span>
                <span className={styles.sublabel}>{m.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && matches.length === 0 ? (
        <div className={styles.empty}>No district or known locality matches. Mandal-level search lives inside Spatial Intelligence.</div>
      ) : null}
    </div>
  );
}
