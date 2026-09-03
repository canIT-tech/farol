import type { ZodType, ZodTypeDef } from "zod";

// O corpo da resposta é JSON não confiável: o schema recebe `unknown` de
// entrada e devolve T. Sem isso, schema com `.default()` não casa com
// ZodType<T>, que assumiria entrada igual à saída.
type ResponseSchema<T> = ZodType<T, ZodTypeDef, unknown>;

export function apiBase(): string {
  // A api serve sob /api (o prefixo evita colidir com as rotas do Next no
  // deploy de servico unico). No servico unico o valor e so "/api".
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api";
}

export interface ApiSendOptions {
  path: string;
  token: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

export interface ApiFetchOptions<T> extends ApiSendOptions {
  schema: ResponseSchema<T>;
}

function buildInit(opts: ApiSendOptions): RequestInit {
  const headers: Record<string, string> = { authorization: `Bearer ${opts.token}` };
  const init: RequestInit = { method: opts.method ?? "GET", headers, cache: "no-store" };
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return init;
}

// Para as rotas que respondem 202/201 sem corpo: chamar res.json() ali estoura.
export async function apiSend(
  opts: ApiSendOptions,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(`${apiBase()}${opts.path}`, buildInit(opts));
  if (!res.ok) {
    throw new Error(`api ${opts.path} respondeu ${res.status}`);
  }
}

// Chamada autenticada à apps/api: anexa o Bearer, valida a resposta com o schema
// e lança em erro HTTP ou payload fora do schema.
export async function apiFetch<T>(
  opts: ApiFetchOptions<T>,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const res = await fetchImpl(`${apiBase()}${opts.path}`, buildInit(opts));
  if (!res.ok) {
    throw new Error(`api ${opts.path} respondeu ${res.status}`);
  }
  return opts.schema.parse(await res.json());
}

// Rotas públicas (/geo, /waitlist): não têm Bearer. Mesmo contrato de validação.
export async function apiFetchPublic<T>(
  opts: { path: string; schema: ResponseSchema<T> },
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const res = await fetchImpl(`${apiBase()}${opts.path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`api ${opts.path} respondeu ${res.status}`);
  }
  return opts.schema.parse(await res.json());
}
