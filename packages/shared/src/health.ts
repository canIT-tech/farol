import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  checks: z.object({ db: z.enum(["up", "down"]) }),
  version: z.string(),
  // Commit em execução. É assim que o deploy prova que *este* commit está no ar.
  sha: z.string()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
