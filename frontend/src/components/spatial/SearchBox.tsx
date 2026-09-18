"use client";

import { useMemo, useState } from "react";
import type { DistrictsFeatureCollection, MandalsFeatureCollection } from "@/lib/api";
import styles from "./SearchBox.module.css";

type Match = { type: "district" | "mandal"; id: string; label: string; sublabel: string };

export function SearchBox({
  districts,
  loadedMandals,
  onSelectDistrict,
  onSelectMandal,
}: {
  districts: DistrictsFeatureCollection;
  loadedMandals: Map<string, MandalsFeatureCollection>;
  onSelectDistrict: (districtId: string) => void;
  onSelectMandal: (districtId: string, mandalId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo<Match[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const districtMatches: Match[] = districts.features
      .filter((f) => f.properties.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((f) => ({ type: "district", id: f.properties.district_id, label: f.properties.name, sublabel: "District" }));

    const mandalMatches: Match[] = [];
    for (const [districtId, collection] of loadedMandals.entries()) {
      for (const f of collection.features) {
        if (f.properties.name.toLowerCase().includes(q)) {
          mandalMatches.push({
            type: "mandal",
            id: `${districtId}::${f.properties.mandal_id}`,
            label: f.properties.name,
            sublabel: `Mandal, ${f.properties.district_name}`,
          });
        }
      }
    }
    return [...districtMatches, ...mandalMatches.slice(0, 6)];
  }, [query, districts, loadedMandals]);

  const handleSelect = (m: Match) => {
    if (m.type === "district") {
      onSelectDistrict(m.id);
    } else {
      const [districtId, mandalId] = m.id.split("::");
      onSelectMandal(districtId, mandalId);
    }
    setQuery(m.label);
    setOpen(false);
  };

  return (
    <div className={`${styles.wrap} card`}>
      <input
        className={styles.input}
        type="text"
        placeholder="Search district or mandal…"
        value={query}
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
            <li key={`${m.type}-${m.id}`}>
              <button type="button" className={styles.result} onMouseDown={() => handleSelect(m)}>
                <span>{m.label}</span>
                <span className={styles.sublabel}>{m.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && matches.length === 0 ? (
        <div className={styles.empty}>
          No match among districts or already-loaded mandals. Select a district to load its mandals.
        </div>
      ) : null}
    </div>
  );
}
