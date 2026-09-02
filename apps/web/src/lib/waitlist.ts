import { waitlistSignupResultSchema, type WaitlistSignupResult } from "@farol/shared";
import { apiBase } from "./api-client";

// POST /waitlist na apps/api (rota pública, sem auth).
// Lança em erro HTTP ou payload fora do schema.
export async function submitWaitlist(
  email: string,
  source: string,
  fetchImpl: typeof fetch = fetch
): Promise<WaitlistSignupResult> {
  const res = await fetchImpl(`${apiBase()}/waitlist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, source })
  });
  if (!res.ok) {
    throw new Error(`waitlist respondeu ${res.status}`);
  }
  return waitlistSignupResultSchema.parse(await res.json());
}
