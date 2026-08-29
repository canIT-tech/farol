import { healthResponseSchema, type HealthResponse } from "@farol/shared";
import { apiBase } from "./api-client";

export { apiBase };

export async function fetchHealth(fetchImpl: typeof fetch = fetch): Promise<HealthResponse> {
  const res = await fetchImpl(`${apiBase()}/health`, { cache: "no-store" });
  if (res.status !== 200) {
    throw new Error(`health respondeu ${res.status}`);
  }
  return healthResponseSchema.parse(await res.json());
}
