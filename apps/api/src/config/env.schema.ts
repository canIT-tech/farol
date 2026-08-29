import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3333),
  SUPABASE_JWKS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_MODEL_CAPABLE: z.string().min(1).default("claude-sonnet-5"),
  LLM_MODEL_CHEAP: z.string().min(1).default("claude-haiku-4-5-20251001"),
  JOBS_SCHEMA: z.string().min(1).default("pgboss")
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const r = envSchema.safeParse(raw);
  if (!r.success) {
    const fields = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Env inválida: ${fields}`);
  }
  return r.data;
}
