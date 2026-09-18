import type { DistrictsFeatureCollection } from "@/lib/api";
import styles from "./ScenarioControls.module.css";

export function ScenarioControls({
  districts,
  geoId,
  onGeoIdChange,
  foodCategories,
  foodCategory,
  onFoodCategoryChange,
}: {
  districts: DistrictsFeatureCollection;
  geoId: string;
  onGeoIdChange: (id: string) => void;
  foodCategories: string[];
  foodCategory: string;
  onFoodCategoryChange: (v: string) => void;
}) {
  const sorted = [...districts.features].sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  return (
    <div className={styles.panel}>
      <div className={styles.groupTitle}>Geography</div>
      <select className={styles.select} value={geoId} onChange={(e) => onGeoIdChange(e.target.value)}>
        {sorted.map((f) => (
          <option key={f.properties.district_id} value={f.properties.district_id}>
            {f.properties.name}
          </option>
        ))}
      </select>
      <button type="button" className={styles.hydButton} onClick={() => onGeoIdChange("hyderabad")}>
        Use Hyderabad (principal demand hub)
      </button>

      <div className={styles.groupTitle} style={{ marginTop: 18 }}>
        Food category
      </div>
      <select className={styles.select} value={foodCategory} onChange={(e) => onFoodCategoryChange(e.target.value)}>
        {foodCategories.map((c) => (
          <option key={c} value={c}>
            {c.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <p className={styles.note}>
        Food-agnostic by design — any category can be selected, not just staples. The v0 risk baseline currently
        applies the same climate-stress proxy to every category (documented limitation).
      </p>
    </div>
  );
}
