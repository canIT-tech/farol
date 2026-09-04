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

// A resposta fora do schema é erro nosso, não da pessoa: o ZodError traz o
// JSON inteiro das issues em `message`, e ele chegava cru na tela. Aqui vira
// uma frase, e o detalhe técnico fica no console para quem está depurando.
/** Erro de uma chamada à api, com o status para quem precisa distinguir —
 *  "sem perfil ainda" (404) não é o mesmo que "a api caiu" (500). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// A api devolve { statusCode, code, message } nos erros de domínio, e a
// message é escrita para quem está lendo a tela. Sem isto, todo 4xx virava
// "api /trips/x/discovery respondeu 422", que não diz o que fazer.
/** Nome do evento de janela disparado quando a api recusa a credencial.
 *  O AuthGate escuta e leva a pessoa de volta ao login. Evento de DOM em vez de
 *  um handler global neste módulo: não deixa estado pendurado entre testes e
 *  não amarra o api-client a quem reage. */
export const UNAUTHORIZED_EVENT = "farol:unauthorized";

const UNAUTHORIZED = 401;

async function failure(res: Response, path: string): Promise<ApiError> {
  // Só o 401 derruba a sessão. 403 é "essa viagem é de outra pessoa" e 5xx é
  // problema nosso — nenhum dos dois é motivo para deslogar quem está dentro.
  if (res.status === UNAUTHORIZED && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  try {
    const body: unknown = await res.json();
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") {
      return new ApiError(message, res.status, path);
    }
  } catch {
    // corpo vazio ou não-JSON: cai no genérico
  }
  return new ApiError(`api ${path} respondeu ${res.status}`, res.status, path);
}

function parseOrFail<T>(schema: ResponseSchema<T>, payload: unknown, path: string): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    console.error(`api_response_invalid ${path}`, parsed.error.issues);
    throw new Error(`a api respondeu ${path} num formato que eu não reconheço`);
  }
  return parsed.data;
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
    throw await failure(res, opts.path);
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
    throw await failure(res, opts.path);
  }
  return parseOrFail(opts.schema, await res.json(), opts.path);
}

// Rotas públicas (/geo, /waitlist): não têm Bearer. Mesmo contrato de validação.
export async function apiFetchPublic<T>(
  opts: { path: string; schema: ResponseSchema<T> },
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const res = await fetchImpl(`${apiBase()}${opts.path}`, { cache: "no-store" });
  if (!res.ok) {
    throw await failure(res, opts.path);
  }
  return parseOrFail(opts.schema, await res.json(), opts.path);
}
