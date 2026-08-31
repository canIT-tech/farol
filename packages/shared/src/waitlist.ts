import { z } from "zod";

// Cadastro na lista de espera (landing pública, sem login).
// email normalizado (trim + lowercase) antes de validar/gravar.
export const waitlistSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  source: z.string().trim().min(1).max(60).optional()
});
export type WaitlistSignup = z.infer<typeof waitlistSignupSchema>;

// Resposta do POST /waitlist. `created` = false quando o e-mail já estava na lista
// (a API responde igual nos dois casos para não vazar quem já se cadastrou).
export const waitlistSignupResultSchema = z.object({
  ok: z.literal(true),
  created: z.boolean()
});
export type WaitlistSignupResult = z.infer<typeof waitlistSignupResultSchema>;

// Resposta do GET /waitlist/count — usada pelo contador da landing.
export const waitlistCountSchema = z.object({
  count: z.number().int().nonnegative()
});
export type WaitlistCount = z.infer<typeof waitlistCountSchema>;
