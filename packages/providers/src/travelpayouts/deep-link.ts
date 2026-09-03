export const AVIASALES_BASE_URL = "https://www.aviasales.com";

// Template padrão do deep link de voo: cai na busca do Aviasales já com o
// marker de afiliado (spec de migração §7 — todo link de saída rende comissão).
export const AVIASALES_SEARCH_TEMPLATE =
  `${AVIASALES_BASE_URL}/search/{origin}{departDdmm}{destination}{returnDdmm}{passengers}?marker={marker}`;

// "2026-10-22" -> "2210". O Aviasales codifica a data como dia+mês no path da busca.
export function ddmm(isoDate: string): string {
  return `${isoDate.slice(8, 10)}${isoDate.slice(5, 7)}`;
}

// Anexa o marker de afiliado preservando a query que a URL já tenha.
export function withMarker(url: string, marker: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}marker=${encodeURIComponent(marker)}`;
}

// O /v2/prices/nearest-places-matrix devolve o caminho relativo da busca já com
// a tarifa exata. Vale muito mais que remontar a URL: só falta o host e o marker.
export function aviasalesLink(relativePath: string, marker: string): string {
  return withMarker(`${AVIASALES_BASE_URL}${relativePath}`, marker);
}
