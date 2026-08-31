// Nomes de fila compartilhados entre a api (publish) e o worker (work).
export const JOB_NAMES = {
  itineraryGenerate: "itinerary.generate",
  itineraryRegenerateDay: "itinerary.regenerate-day",
  placesEnrich: "places.enrich"
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
