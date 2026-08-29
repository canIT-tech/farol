import type { RankDestinationsInput } from "../llm.types";

export const RANK_SYSTEM =
  "Você é um assessor de viagem. Recebe uma lista de destinos candidatos e o perfil da pessoa. " +
  "Escolha de 3 a 5 destinos DA LISTA (nunca invente). Responda só com um array JSON, sem comentários, " +
  'no formato [{"iata":"XXX","score":0.0,"rationale":"..."}], score entre 0 e 1, rationale de 10 a 400 caracteres em PT-BR.';

export function buildRankUserPrompt(input: RankDestinationsInput, previousError?: string): string {
  const { profile, trip, shortlist } = input;
  const budget = trip.budgetTotal ?? "não informado";
  const lines = [
    `Origem: ${trip.originIata}. Orçamento total: ${budget} ${trip.currency} para ${trip.party.adults} adulto(s).`,
    `Perfil: ritmo ${profile.pace}, companhia ${profile.partyType}, faixa de gasto ${profile.budgetBand}.`,
    `Interesses: ${profile.interests.join(", ")}.`,
    "Destinos candidatos:",
    ...shortlist.map((seed) => `- ${seed.iata} ${seed.city}/${seed.country} [${seed.tags.join(", ")}]`)
  ];
  if (previousError !== undefined) {
    lines.push(`Sua resposta anterior foi rejeitada: ${previousError}. Responda de novo, só o JSON válido.`);
  }
  return lines.join("\n");
}
