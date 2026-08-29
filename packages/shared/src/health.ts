import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  checks: z.object({ db: z.enum(["up", "down"]) }),
  version: z.string()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
