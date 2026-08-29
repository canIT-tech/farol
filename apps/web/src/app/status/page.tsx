import { fetchHealth } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const h = await fetchHealth();
  return (
    <main>
      <h1>Status</h1>
      <p>API: {h.status}</p>
      <p>Banco: {h.checks.db}</p>
    </main>
  );
}
