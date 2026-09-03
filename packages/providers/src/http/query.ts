export type Query = Record<string, string | number | boolean | undefined>;

// Query string dos providers: chave com valor undefined é omitida. As APIs
// tratam param vazio como filtro, não como ausência — "&limit=" quebra.
export function buildQuery(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}
