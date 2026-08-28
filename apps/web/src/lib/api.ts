import { healthResponseSchema, type HealthResponse } from "@farol/shared";

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
}

export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<HealthResponse> {
  const res = await fetchImpl(`${apiBase()}/health`, { cache: "no-store" });
  if (res.status !== 200) {
    throw new Error(`health respondeu ${res.status}`);
  }
  return healthResponseSchema.parse(await res.json());
}
