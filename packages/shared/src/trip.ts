import { z } from "zod";

export const tripStatusEnum = z.enum(["draft", "planned", "done"]);
export type TripStatus = z.infer<typeof tripStatusEnum>;

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato YYYY-MM-DD");
export const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "mês no formato YYYY-MM");

export const tripPartySchema = z.object({
  adults: z.number().int().min(1),
  children: z.number().int().min(0)
});

// Entrada de criação de viagem. Exatamente um de:
//  - datas exatas: dateStart + dateEnd (end > start)
//  - duração + mês alvo: durationDays (2..30) + targetMonth (YYYY-MM)
export const tripInputSchema = z
  .object({
    originIata: z.string().length(3),
    party: tripPartySchema,
    budgetTotal: z.number().positive(),
    currency: z.string().default("BRL"),
    title: z.string().min(1).optional(),
    dateStart: isoDateSchema.optional(),
    dateEnd: isoDateSchema.optional(),
    durationDays: z.number().int().min(2).max(30).optional(),
    targetMonth: yearMonthSchema.optional()
  })
  .superRefine((value, ctx) => {
    const hasDates = value.dateStart !== undefined && value.dateEnd !== undefined;
    const hasDuration = value.durationDays !== undefined && value.targetMonth !== undefined;

    if (hasDates === hasDuration) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "informe datas (dateStart+dateEnd) ou duração (durationDays+targetMonth), exatamente um"
      });
      return;
    }
    if (hasDates && value.dateEnd! <= value.dateStart!) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateEnd"],
        message: "dateEnd deve ser posterior a dateStart"
      });
    }
  });
export type TripInput = z.infer<typeof tripInputSchema>;
