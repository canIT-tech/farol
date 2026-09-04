import { describe, it, expect } from "vitest";
import { corsOptions, parseOrigins } from "./cors";

describe("parseOrigins", () => {
  it("separa por vírgula e tira espaço", () => {
    expect(parseOrigins("http://a.test, http://b.test")).toEqual(["http://a.test", "http://b.test"]);
  });

  it("descarta entradas vazias", () => {
    expect(parseOrigins("http://a.test,,  ,")).toEqual(["http://a.test"]);
  });

  it("vazio não vira origem nenhuma", () => {
    expect(parseOrigins("")).toEqual([]);
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe("corsOptions", () => {
  // Em produção a api e o web são o mesmo processo e a mesma origem
  // (SERVE_WEB=true, NEXT_PUBLIC_API_URL=/api), então não existe requisição
  // cross-origin legítima. Sem lista, o CORS fica fechado — que é mais
  // restrito que o `enableCors()` sem argumento de antes, equivalente a `*`.
  // É o que o render.yaml manda em produção: lá a api e o web são a mesma
  // origem, e o `enableCors()` sem argumento de antes equivalia a `*`.
  it("sem lista, não libera origem alguma", () => {
    expect(corsOptions("")).toEqual({ origin: false });
  });

  it("com lista, libera exatamente o que está nela", () => {
    expect(corsOptions("http://localhost:3000,http://localhost:3100")).toEqual({
      origin: ["http://localhost:3000", "http://localhost:3100"],
      credentials: false
    });
  });

  // A credencial vai no header Authorization, não em cookie. Ligar credentials
  // permitiria cookie cross-origin sem nenhum uso — e é o que transforma um
  // CORS frouxo em CSRF.
  it("nunca aceita credencial de origem cruzada", () => {
    expect(corsOptions("http://a.test")).toMatchObject({ credentials: false });
  });
});
