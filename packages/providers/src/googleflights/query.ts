import type { FlightSearchParams } from "@farol/shared";
import { encodeTfs, type TfsQuery } from "./tfs.js";

export interface GoogleFlightsLocale {
  /** Código de idioma da página, ex.: "pt-BR". Muda os nomes de aeroporto. */
  locale: string;
  /** Moeda dos preços, ex.: "BRL". */
  currency: string;
}

/** Busca do Farol traduzida para as pernas que o Google Flights entende. */
export function toTfsQuery(params: FlightSearchParams): TfsQuery {
  const legs = [
    { date: params.departDate, fromIata: params.originIata, toIata: params.destinationIata }
  ];
  if (params.returnDate !== undefined) {
    legs.push({
      date: params.returnDate,
      fromIata: params.destinationIata,
      toIata: params.originIata
    });
  }
  return {
    legs,
    adults: params.adults,
    children: params.children,
    maxStops: params.maxStops
  };
}

/**
 * URL da busca. É também o deep link das ofertas: abrir esta URL reproduz
 * exatamente a consulta que gerou os preços.
 */
export function searchUrl(
  baseUrl: string,
  params: FlightSearchParams & { maxPrice?: number },
  locale: GoogleFlightsLocale
): string {
  const url = new URL(baseUrl);
  // URLSearchParams escapa o base64 do tfs: sem isso "+" viraria espaço e "="
  // viraria separador, e o Google leria outra busca.
  url.search = new URLSearchParams({
    tfs: encodeTfs({ ...toTfsQuery(params), maxPrice: params.maxPrice }),
    hl: locale.locale,
    curr: locale.currency
  }).toString();
  return url.toString();
}
