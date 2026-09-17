const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
  project: {
    name: string;
    region: string;
    food_scope: string;
    primary_sdg: string;
  };
  loop_stages: string[];
};

async function getBackendHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getBackendHealth();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>GeoAI Food-Resilience Digital Twin</h1>
      <p>Foundation checkpoint: frontend reachability to the backend service.</p>

      {health ? (
        <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem" }}>
          <p style={{ color: "green", fontWeight: "bold" }}>Backend reachable ({health.status})</p>
          <dl>
            <dt>Project</dt>
            <dd>{health.project.name}</dd>
            <dt>Region</dt>
            <dd>{health.project.region}</dd>
            <dt>Food scope</dt>
            <dd>{health.project.food_scope}</dd>
            <dt>Primary SDG</dt>
            <dd>{health.project.primary_sdg}</dd>
            <dt>Core loop</dt>
            <dd>{health.loop_stages.join(" → ")}</dd>
            <dt>Backend timestamp</dt>
            <dd>{health.timestamp}</dd>
          </dl>
        </section>
      ) : (
        <section style={{ border: "1px solid #c00", borderRadius: 8, padding: "1rem" }}>
          <p style={{ color: "#c00", fontWeight: "bold" }}>
            Backend unreachable at {API_URL}. Start it with:
            <br />
            <code>.venv\Scripts\python -m uvicorn backend.api.main:app --reload</code>
          </p>
        </section>
      )}
    </main>
  );
}
