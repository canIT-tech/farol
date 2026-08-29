import { z } from "zod";

// Perfil de gosto — enums do design §5.2 (valores em PT-BR, os mesmos gravados em taste_profiles).
export const paceEnum = z.enum(["relaxado", "moderado", "intenso"]);
export const partyEnum = z.enum(["sozinho", "casal", "familia", "amigos"]);
export const budgetEnum = z.enum(["economico", "medio", "conforto", "luxo"]);

// Restrições declaradas no onboarding — todos os campos são opcionais.
export const tasteConstraintsSchema = z.object({
  mobility: z.boolean().optional(),
  kids: z.boolean().optional(),
  pet: z.boolean().optional(),
  dietary: z.array(z.string()).optional()
});

// Payload que o web envia no PUT /me/profile.
export const tasteProfileInputSchema = z.object({
  interests: z.array(z.string().min(1)).min(3),
  pace: paceEnum,
  partyType: partyEnum,
  budgetBand: budgetEnum,
  constraints: tasteConstraintsSchema.default({})
});
export type TasteProfileInput = z.infer<typeof tasteProfileInputSchema>;

// Perfil como a api devolve (input + campos gerados no servidor).
export const tasteProfileSchema = tasteProfileInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  updatedAt: z.string()
});
export type TasteProfile = z.infer<typeof tasteProfileSchema>;
