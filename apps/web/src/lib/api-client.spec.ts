import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import {
  ApiError,
  UNAUTHORIZED_EVENT,
  apiBase,
  apiFetch,
  apiFetchPublic,
  apiSend
} from "./api-client";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

const schema = z.object({ id: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("apiBase", () => {
  it("cai para localhost:3333/api sem env", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(apiBase()).toBe("http://localhost:3333/api");
  });

  it("usa NEXT_PUBLIC_API_URL quando definida", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.farol.test";
    expect(apiBase()).toBe("https://api.farol.test");
  });
});

describe("apiFetch", () => {
  it("faz GET em {base}{path} com Bearer e no-store, e valida a resposta", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.farol.test";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "p-1" }));

    const out = await apiFetch({ path: "/me/profile", schema, token: "tok-123" }, fetchImpl);

    expect(out).toEqual({ id: "p-1" });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.farol.test/me/profile", {
      method: "GET",
      headers: { authorization: "Bearer tok-123" },
      cache: "no-store"
    });
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("body");
  });

  it("envia body JSON e content-type quando há body, com o método informado", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "p-2" }));

    await apiFetch(
      { path: "/me/profile", schema, token: "t", method: "PUT", body: { a: 1 } },
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:3333/api/me/profile", {
      method: "PUT",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
      cache: "no-store"
    });
  });

  it("lança com path e status quando a resposta não é ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    await expect(
      apiFetch({ path: "/me/profile", schema, token: "t" }, fetchImpl)
    ).rejects.toThrow("api /me/profile respondeu 401");
  });

  it("lança quando o payload não bate o schema", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 42 }));
    try {
      await expect(apiFetch({ path: "/x", schema, token: "t" }, fetchImpl)).rejects.toThrow();
    } finally {
      errSpy.mockRestore();
    }
  });
});

describe("apiFetchPublic", () => {
  it("chama sem Authorization e valida o payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "x" }));
    await expect(apiFetchPublic({ path: "/geo/whereami", schema }, fetchImpl)).resolves.toEqual({
      id: "x"
    });
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:3333/api/geo/whereami", {
      cache: "no-store"
    });
  });

  it("lança com path e status quando a resposta não é ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(apiFetchPublic({ path: "/geo/whereami", schema }, fetchImpl)).rejects.toThrow(
      "api /geo/whereami respondeu 503"
    );
  });

  it("lança quando o payload não bate o schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 42 }));
    await expect(apiFetchPublic({ path: "/x", schema }, fetchImpl)).rejects.toThrow();
  });

  it("resposta fora do schema vira frase legível, com o detalhe no console", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ nome: 123 }), { status: 200 })
    ) as unknown as typeof fetch;

    try {
      await expect(
        apiFetch({ path: "/me/profile", token: "t", schema: z.object({ nome: z.string() }) }, fetchImpl)
      ).rejects.toThrow("a api respondeu /me/profile num formato que eu não reconheço");
      expect(errSpy.mock.calls[0]![0]).toContain("api_response_invalid /me/profile");
    } finally {
      errSpy.mockRestore();
    }
  });

});

// A api escreve a mensagem de erro para quem lê a tela; descartá-la deixava
// "api /trips/x/discovery respondeu 422", que não diz o que fazer.
describe("mensagem de erro da api", () => {
  function failing(status: number, body: unknown) {
    return vi.fn(async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;
  }

  it("usa a message do corpo quando existe", async () => {
    const fetchImpl = failing(422, {
      statusCode: 422,
      code: "no_destinations_in_budget",
      message: "nenhum destino cabe nesse orçamento"
    });
    await expect(
      apiFetch({ path: "/trips/x/discovery", schema, token: "t" }, fetchImpl)
    ).rejects.toThrow("nenhum destino cabe nesse orçamento");
  });

  it("cai no genérico quando o corpo não é JSON", async () => {
    await expect(
      apiFetch({ path: "/x", schema, token: "t" }, failing(500, "<html>erro</html>"))
    ).rejects.toThrow("api /x respondeu 500");
  });

  it("cai no genérico quando o JSON não traz message", async () => {
    await expect(
      apiFetch({ path: "/x", schema, token: "t" }, failing(404, { statusCode: 404 }))
    ).rejects.toThrow("api /x respondeu 404");
  });

  it("cai no genérico quando a message é vazia", async () => {
    await expect(
      apiFetch({ path: "/x", schema, token: "t" }, failing(400, { message: "" }))
    ).rejects.toThrow("api /x respondeu 400");
  });

  it("vale também para apiSend e apiFetchPublic", async () => {
    await expect(
      apiSend({ path: "/trips/x/destination", token: "t", method: "POST" }, failing(409, { message: "já escolhido" }))
    ).rejects.toThrow("já escolhido");
    await expect(
      apiFetchPublic({ path: "/geo/whereami", schema }, failing(503, { message: "fora do ar" }))
    ).rejects.toThrow("fora do ar");
  });

  it("carrega o status, para quem precisa distinguir 404 de 500", async () => {
    const fetchImpl = failing(404, { message: "not found" });
    await apiFetch({ path: "/me/profile", schema, token: "t" }, fetchImpl).catch((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
      expect((err as ApiError).path).toBe("/me/profile");
    });
    expect.assertions(3);
  });
});

describe("aviso de sessão morta", () => {
  function ouvir(): { calls: number } {
    const box = { calls: 0 };
    const handler = () => {
      box.calls += 1;
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    afterEachHandlers.push(() => window.removeEventListener(UNAUTHORIZED_EVENT, handler));
    return box;
  }
  const afterEachHandlers: (() => void)[] = [];
  afterEach(() => {
    while (afterEachHandlers.length > 0) {
      afterEachHandlers.pop()!();
    }
  });

  // Com a renovação do Supabase funcionando, um 401 já não é token vencido: é
  // sessão morta de verdade. Quem estiver ouvindo leva a pessoa de volta ao
  // login em vez de deixar um texto de erro na tela.
  it("avisa quando a api responde 401", async () => {
    const visto = ouvir();
    const f = vi.fn(async () => new Response("nope", { status: 401 }));
    await expect(
      apiFetch({ path: "/trips", token: "t", schema: z.array(z.unknown()) }, f as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(ApiError);
    expect(visto.calls).toBe(1);
  });

  it("avisa também quando quem falha é um envio", async () => {
    const visto = ouvir();
    const f = vi.fn(async () => new Response("nope", { status: 401 }));
    await expect(
      apiSend({ path: "/trips/x", method: "DELETE", token: "t" }, f as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(ApiError);
    expect(visto.calls).toBe(1);
  });

  // 403 é "essa viagem é de outra pessoa" e 500 é problema nosso: nenhum dos
  // dois é motivo para derrubar a sessão de quem está logado.
  it.each([403, 404, 422, 500])("não avisa em %i", async (status) => {
    const visto = ouvir();
    const f = vi.fn(async () => new Response("erro", { status }));
    await expect(
      apiFetch({ path: "/trips", token: "t", schema: z.array(z.unknown()) }, f as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(ApiError);
    expect(visto.calls).toBe(0);
  });

  it("avisa quando uma rota pública responde 401", async () => {
    const visto = ouvir();
    const f = vi.fn(async () => new Response("nope", { status: 401 }));
    await expect(
      apiFetchPublic({ path: "/geo/whereami", schema: z.unknown() }, f as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(ApiError);
    expect(visto.calls).toBe(1);
  });
});
