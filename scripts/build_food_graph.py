"""Build the Telangana food-system graph: production -> aggregation ->
storage -> market -> demand, per district, plus cross-district transport
edges and a Hyderabad demand-hub linkage. Deterministic, reproducible.

Data discipline (see docs/MASTER_HANDOFF.md section 10/22 and the Hours 8-11
task brief): real facility-level data on aggregation centres, storage
warehouses, and exact production volumes was not obtainable as open,
structured data in this sprint (govt portals equivalent to TGRAC were not
retried; no reason to expect different reachability). Rather than invent
facility names/capacities, this pipeline:
  - Uses REAL OpenStreetMap marketplace POIs where one exists in a district
    (truth_status OBSERVED, real name/location).
  - Uses REAL district adjacency from the already-processed spatial layer
    for the cross-district transport backbone (truth_status DERIVED).
  - Uses clearly labeled SCENARIO/SIMULATED placeholder nodes for
    production, aggregation, storage, demand, and for markets in districts
    with no mapped OSM marketplace -- no capacity, volume, or throughput
    numbers are invented for any of them.

Re-run with: .venv\\Scripts\\python scripts\\build_food_graph.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import yaml
from shapely.geometry import Point

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

RAW_MARKETS_PATH = REPO_ROOT / "data" / "raw" / "food_graph" / "osm_markets_raw.json"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"


def _load_all_food_categories() -> list[str]:
    with open(REPO_ROOT / "config" / "features.yaml", "r", encoding="utf-8") as f:
        return yaml.safe_load(f)["food_categories"]


# No data differentiates which food categories move through which node/edge
# this sprint, so every node/edge is marked as supporting every configured
# category (no evidence to exclude any) rather than only a meaningless
# "all_food" label that would make per-category filtering return nothing.
FOOD_CATEGORIES_DEFAULT = _load_all_food_categories()


def load_districts() -> gpd.GeoDataFrame:
    return gpd.read_file(PROCESSED_DIR / "telangana_districts.geojson")


def assign_markets_to_districts(districts: gpd.GeoDataFrame) -> dict[str, dict]:
    """For each district, pick the nearest real OSM marketplace POI to its
    centroid (if any exist inside it); districts with none get no entry
    here (caller creates a SIMULATED placeholder instead)."""
    raw = json.loads(RAW_MARKETS_PATH.read_text(encoding="utf-8-sig"))
    market_points = [
        {"osm_id": el["id"], "name": el.get("tags", {}).get("name"), "lon": el["lon"], "lat": el["lat"]}
        for el in raw["elements"]
        if el["type"] == "node"
    ]

    assigned: dict[str, dict] = {}
    for _, drow in districts.iterrows():
        district_id = drow["district_id"]
        centroid = Point(drow["centroid_lon"], drow["centroid_lat"])
        candidates = [m for m in market_points if drow["geometry"].contains(Point(m["lon"], m["lat"]))]
        if not candidates:
            continue
        nearest = min(candidates, key=lambda m: centroid.distance(Point(m["lon"], m["lat"])))
        assigned[district_id] = nearest

    return assigned


def compute_adjacency(districts: gpd.GeoDataFrame) -> dict[str, list[str]]:
    adjacency: dict[str, list[str]] = {}
    for _, row in districts.iterrows():
        neighbors = districts[districts.geometry.touches(row.geometry)]["district_id"].tolist()
        adjacency[row["district_id"]] = neighbors
    return adjacency


def main() -> None:
    districts = load_districts()
    market_assignment = assign_markets_to_districts(districts)
    adjacency = compute_adjacency(districts)
    built_at = datetime.now(timezone.utc).isoformat()

    nodes = []
    edges = []

    for _, drow in districts.iterrows():
        district_id = drow["district_id"]
        district_name = drow["name"]

        # PRODUCTION: real administrative entity, no fabricated volume.
        nodes.append(
            {
                "node_id": f"production_{district_id}",
                "node_type": "production",
                "geo_id": district_id,
                "geo_level": "district",
                "name": f"{district_name} production (district-level, unspecified crop mix)",
                "food_categories": FOOD_CATEGORIES_DEFAULT,
                "capacity": None,
                "truth_status": "DERIVED",
                "provenance": "Derived from the processed Telangana district layer (data/processed/telangana_districts.geojson); represents that agricultural production occurs in this district, not a specific measured volume.",
            }
        )

        # AGGREGATION / STORAGE: no real facility data obtained this sprint -> scenario placeholders.
        nodes.append(
            {
                "node_id": f"aggregation_{district_id}",
                "node_type": "aggregation",
                "geo_id": district_id,
                "geo_level": "district",
                "name": f"{district_name} aggregation (scenario placeholder)",
                "food_categories": FOOD_CATEGORIES_DEFAULT,
                "capacity": None,
                "truth_status": "SIMULATED",
                "provenance": "No real aggregation-centre dataset was obtained this sprint. This is a modeled placeholder representing an aggregation function in this district, not a specific real facility.",
            }
        )
        nodes.append(
            {
                "node_id": f"storage_{district_id}",
                "node_type": "storage",
                "geo_id": district_id,
                "geo_level": "district",
                "name": f"{district_name} storage (scenario placeholder)",
                "food_categories": FOOD_CATEGORIES_DEFAULT,
                "capacity": None,
                "truth_status": "SIMULATED",
                "provenance": "No real warehouse/cold-storage dataset was obtained this sprint. This is a modeled placeholder representing a storage function in this district, not a specific real facility.",
            }
        )

        # MARKET: real OSM POI if one falls inside the district, else placeholder.
        market = market_assignment.get(district_id)
        if market is not None:
            nodes.append(
                {
                    "node_id": f"market_{district_id}",
                    "node_type": "market",
                    "geo_id": district_id,
                    "geo_level": "district",
                    "name": market["name"] or f"Unnamed marketplace ({district_name})",
                    "food_categories": FOOD_CATEGORIES_DEFAULT,
                    "capacity": None,
                    "lon": market["lon"],
                    "lat": market["lat"],
                    "truth_status": "OBSERVED",
                    "provenance": f"OpenStreetMap marketplace POI, osm node id {market['osm_id']}, nearest to the district centroid among marketplaces within the district polygon.",
                }
            )
        else:
            nodes.append(
                {
                    "node_id": f"market_{district_id}",
                    "node_type": "market",
                    "geo_id": district_id,
                    "geo_level": "district",
                    "name": f"{district_name} market (scenario placeholder)",
                    "food_categories": FOOD_CATEGORIES_DEFAULT,
                    "capacity": None,
                    "truth_status": "SIMULATED",
                    "provenance": "No OpenStreetMap marketplace POI was found within this district's polygon at access time. This is a modeled placeholder, not a specific real market.",
                }
            )

        # DEMAND: Hyderabad is the project's declared principal demand hub (a scope
        # decision, not fabricated data); every other district gets a modeled local-demand node.
        is_hub = district_id == "hyderabad"
        nodes.append(
            {
                "node_id": f"demand_{district_id}",
                "node_type": "demand",
                "geo_id": district_id,
                "geo_level": "district",
                "name": f"{district_name} demand" + (" (principal regional demand hub)" if is_hub else " (local, modeled)"),
                "food_categories": FOOD_CATEGORIES_DEFAULT,
                "capacity": None,
                "is_principal_demand_hub": is_hub,
                "truth_status": "DERIVED" if is_hub else "SIMULATED",
                "provenance": (
                    "Hyderabad's role as principal regional demand hub is a project-scope fact stated in "
                    "docs/MASTER_HANDOFF.md section 2, not a measured consumption figure."
                    if is_hub
                    else "No real district-level consumption/demand dataset was obtained this sprint. This is a modeled local-demand placeholder, not a measured quantity."
                ),
            }
        )

        # Within-district flow chain: modeled dependency, not a measured flow -- SIMULATED.
        chain = [
            (f"production_{district_id}", f"aggregation_{district_id}"),
            (f"aggregation_{district_id}", f"storage_{district_id}"),
            (f"storage_{district_id}", f"market_{district_id}"),
            (f"market_{district_id}", f"demand_{district_id}"),
        ]
        for src, dst in chain:
            edges.append(
                {
                    "edge_id": f"{src}__{dst}",
                    "source": src,
                    "target": dst,
                    "edge_type": "modeled_flow",
                    "food_categories": FOOD_CATEGORIES_DEFAULT,
                    "weight": None,
                    "truth_status": "SIMULATED",
                    "provenance": "Modeled dependency edge (production->aggregation->storage->market->demand chain); no observed flow volume exists for this link.",
                }
            )

        # Hub linkage: every district's market can modeled-supply the Hyderabad demand hub.
        if not is_hub:
            edges.append(
                {
                    "edge_id": f"market_{district_id}__demand_hyderabad",
                    "source": f"market_{district_id}",
                    "target": "demand_hyderabad",
                    "edge_type": "modeled_supply_to_hub",
                    "food_categories": FOOD_CATEGORIES_DEFAULT,
                    "weight": None,
                    "truth_status": "SIMULATED",
                    "provenance": "Modeled potential supply linkage to the principal regional demand hub (Hyderabad); no observed trade volume exists for this link.",
                }
            )

    # Cross-district transport backbone: real geometric adjacency between district polygons.
    seen_pairs = set()
    for district_id, neighbors in adjacency.items():
        for neighbor_id in neighbors:
            pair = tuple(sorted((district_id, neighbor_id)))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            for a, b in [(district_id, neighbor_id), (neighbor_id, district_id)]:
                edges.append(
                    {
                        "edge_id": f"transport_market_{a}__market_{b}",
                        "source": f"market_{a}",
                        "target": f"market_{b}",
                        "edge_type": "transport_link",
                        "food_categories": FOOD_CATEGORIES_DEFAULT,
                        "weight": None,
                        "truth_status": "DERIVED",
                        "provenance": "Derived from real district-polygon adjacency (shared border) in the processed spatial layer; represents modeled transport connectivity between neighboring districts' markets, not a specific observed route or its capacity.",
                    }
                )

    graph = {
        "built_at": built_at,
        "layers": ["production", "aggregation", "storage", "market", "demand", "transport_link"],
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
    }
    (PROCESSED_DIR / "food_graph.json").write_text(json.dumps(graph, indent=2), encoding="utf-8")

    real_market_count = sum(1 for n in nodes if n["node_type"] == "market" and n["truth_status"] == "OBSERVED")
    provenance = {
        "generated_at": built_at,
        "datasets": [
            {
                "dataset_name": "OpenStreetMap marketplace points of interest (Telangana)",
                "publisher": "OpenStreetMap contributors",
                "source_url": "https://overpass-api.de/api/interpreter (amenity=marketplace OR shop=marketplace within OSM relation 3250963 'Telangana')",
                "access_date": built_at,
                "license": "Open Database License (ODbL) v1.0 -- requires attribution 'Data (c) OpenStreetMap contributors'",
                "geographic_level": "point",
                "crs": "EPSG:4326",
                "processing": f"Queried all amenity=marketplace/shop=marketplace nodes in Telangana ({len(json.loads(RAW_MARKETS_PATH.read_text(encoding='utf-8-sig'))['elements'])} found); assigned to a district via point-in-polygon against the processed district layer, keeping the POI nearest the district centroid where multiple existed.",
                "truth_status": "OBSERVED",
                "limitations": f"Real OSM marketplace POIs were found for {real_market_count}/{len(districts)} districts; the remaining districts use a clearly labeled SIMULATED placeholder market node. Community-mapped, not an authoritative government market registry (AGMARKNET/e-NAM were attempted but not programmatically accessible without a registered API key or complex ASP.NET session scraping in this sprint).",
            },
            {
                "dataset_name": "District adjacency (transport backbone)",
                "publisher": "Derived from the processed Telangana district layer",
                "source_url": "n/a -- computed",
                "access_date": built_at,
                "license": "Inherits ODbL from the underlying OSM district geometries",
                "geographic_level": "district",
                "crs": "EPSG:4326",
                "processing": "Two districts are considered transport-adjacent if their polygons share a border (geometry.touches). Reuses the same adjacency computation as backend/risk/validation.py's spatial smoothness check.",
                "truth_status": "DERIVED",
                "limitations": "Represents modeled connectivity (neighboring districts are road-reachable), not a specific real route, road class, distance, or capacity.",
            },
        ],
        "food_category_note": (
            "Every node/edge is tagged with every configured food_category (config/features.yaml) because "
            "no data this sprint differentiates which categories move through which node -- this is a "
            "known gap, not a claim that all nodes actually handle all food types equally."
        ),
        "unobtained_sources": [
            {
                "dataset_name": "AGMARKNET / e-NAM market list and arrivals",
                "source_url": "https://www.enam.gov.in/web/dashboard/agmarknet ; https://agmarknet.gov.in/",
                "reason_not_used": "AGMARKNET is an ASP.NET WebForms site requiring session/viewstate-based form submission to retrieve data; agmarknet.gov.in itself is reachable but no data API was accessible without that scripted session flow in this time budget. data.gov.in's API requires a registered api-key which was not available.",
            },
            {
                "dataset_name": "Telangana State Warehousing Corporation / FCI storage facility list",
                "source_url": "n/a -- no public structured dataset located",
                "reason_not_used": "No open, structured (API/CSV/GeoJSON) facility-level dataset was located in this sprint.",
            },
            {
                "dataset_name": "Telangana DES district-level production statistics",
                "source_url": "https://ecostat.telangana.gov.in/agricultural_statistics.html",
                "reason_not_used": "Published as HTML/PDF reports, not a structured API/CSV this sprint's time budget allowed parsing; production nodes therefore carry no volume figures.",
            },
        ],
        "graph_summary": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "real_market_nodes": real_market_count,
            "simulated_market_placeholder_nodes": len(districts) - real_market_count,
        },
    }
    (PROCESSED_DIR / "food_graph_provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")

    print(f"Nodes: {len(nodes)}, Edges: {len(edges)}, real markets: {real_market_count}/{len(districts)}")


if __name__ == "__main__":
    main()
