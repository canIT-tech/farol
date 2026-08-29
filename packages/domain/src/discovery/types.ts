// Linha do destination_catalog já em camelCase e com números (o repo converte do texto do Postgres).
export interface CatalogEntry {
  city: string;
  country: string;
  iata: string;
  tags: string[];
  bestMonths: number[];
  avgFlightCostFromGru: number;
  avgLodgingNight: number;
  avgDailyLocal: number;
  region: string;
  visaFreeBr: boolean;
}

export const BRAZIL_REGION = "brasil";
