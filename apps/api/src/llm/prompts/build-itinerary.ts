import type { BuildItineraryInput } from "../llm.types";

export const BUILD_ITINERARY_SYSTEM =
  "Você é um assessor de viagem. Monte um roteiro dia a dia para o destino informado. " +
  "Responda só com um objeto JSON, sem comentários, no formato " +
  '{"days":[{"dayIndex":1,"slots":[{"slot":"morning","type":"activity","title":"...","description":"...","durationMin":90,"estCost":0}]}]}. ' +
  "slot ∈ morning|afternoon|evening; type ∈ activity|meal|transfer|free; title de 2 a 120 caracteres em PT-BR; " +
  "description opcional até 400 caracteres; durationMin inteiro positivo opcional; estCost número >= 0 opcional. " +
  "Um dayIndex por dia, começando em 1.";

export function buildItineraryUserPrompt(
  input: BuildItineraryInput,
  previousError?: string
): string {
  const { destination, nights, pace, interests, party, pinned } = input;
  const lines = [
    `Destino: ${destination.city}, ${destination.country}.`,
    `Duração: ${nights} dias. Ritmo: ${pace}. Viajantes: ${party.adults} adulto(s), ${party.children} criança(s).`,
    `Interesses: ${interests.join(", ")}.`
  ];
  if (pinned !== undefined && pinned.length > 0) {
    lines.push("Itens já fixados pela pessoa (mantenha-os exatamente, no mesmo dia e slot):");
    for (const item of pinned) {
      lines.push(`- dia ${item.dayIndex}, ${item.slot}, ${item.type}: ${item.title}`);
    }
  }
  if (previousError !== undefined) {
    lines.push(`Sua resposta anterior foi rejeitada: ${previousError}. Responda de novo, só o JSON válido.`);
  }
  return lines.join("\n");
}
