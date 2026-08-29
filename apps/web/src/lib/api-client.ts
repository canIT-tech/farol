import type { ZodType } from "zod";

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
}

export interface ApiFetchOptions<T> {
  path: string;
  schema: ZodType<T>;
  token: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

// Chamada autenticada à apps/api: anexa o Bearer, valida a resposta com o schema
// e lança em erro HTTP ou payload fora do schema.
export async function apiFetch<T>(
  opts: ApiFetchOptions<T>,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const headers: Record<string, string> = { authorization: `Bearer ${opts.token}` };
  const init: RequestInit = { method: opts.method ?? "GET", headers, cache: "no-store" };
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetchImpl(`${apiBase()}${opts.path}`, init);
  if (!res.ok) {
    throw new Error(`api ${opts.path} respondeu ${res.status}`);
  }
  return opts.schema.parse(await res.json());
}
