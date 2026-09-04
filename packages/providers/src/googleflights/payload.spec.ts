import { describe, expect, it } from "vitest";
import { GoogleFlightsParseError, extractPayload } from "./payload.js";

function page(script: string): string {
  return `<!doctype html><html><body><script class="ds:0" nonce="x">AF_initDataCallback({key: 'ds:0', data:[1], sideChannel: {}});</script>${script}</body></html>`;
}

const OK = page(
  `<script class="ds:1" nonce="abc">AF_initDataCallback({key: 'ds:1', hash: '9', data:[[null,"a"],[2]], sideChannel: {}});</script>`
);

describe("extractPayload", () => {
  it("lê o payload do script ds:1", () => {
    expect(extractPayload(OK)).toEqual([[null, "a"], [2]]);
  });

  // O ds:0 vem antes no HTML e também é um AF_initDataCallback. Uma regex sem
  // âncora na classe pegaria ele e devolveria [1] em vez dos voos.
  it("ignora os outros scripts ds:N", () => {
    expect(extractPayload(OK)).not.toEqual([1]);
  });

  it("aceita a tag sem o atributo nonce", () => {
    expect(
      extractPayload(page(`<script class="ds:1">AF_initDataCallback({data:[7], sideChannel: {}});</script>`))
    ).toEqual([7]);
  });

  it("reclama quando não há script ds:1", () => {
    expect(() => extractPayload("<html><body>bloqueado</body></html>")).toThrow(
      GoogleFlightsParseError
    );
  });

  it("reclama quando o script não tem o marcador data:", () => {
    expect(() =>
      extractPayload(page(`<script class="ds:1">AF_initDataCallback({key: 'ds:1'});</script>`))
    ).toThrow(/data:/);
  });

  it("reclama quando o payload não é JSON válido", () => {
    expect(() =>
      extractPayload(page(`<script class="ds:1">AF_initDataCallback({data:[1,, sideChannel: {}});</script>`))
    ).toThrow(GoogleFlightsParseError);
  });

  // O Google sinaliza busca inválida (rota inexistente, data no passado) sem
  // mudar o status HTTP: a resposta é 200 com este marcador no lugar do array.
  it("reconhece o erro que o Google devolve dentro de um 200", () => {
    expect(() =>
      extractPayload(
        page(`<script class="ds:1">AF_initDataCallback({data:[], errorHasStatus: true, sideChannel: {}});</script>`)
      )
    ).toThrow(/google/i);
  });

  // O log do fallback registra String(error), então o nome da classe é o que
  // distingue "mudaram o layout" de "fomos bloqueados" no monitoramento.
  it("se identifica pelo nome no texto do erro", () => {
    try {
      extractPayload("<html></html>");
      expect.unreachable();
    } catch (error) {
      expect((error as Error).name).toBe("GoogleFlightsParseError");
      expect(String(error)).toContain("GoogleFlightsParseError");
    }
  });

  it("reclama quando o payload não é um array", () => {
    expect(() =>
      extractPayload(page(`<script class="ds:1">AF_initDataCallback({data:{"a":1}, sideChannel: {}});</script>`))
    ).toThrow(/array/i);
  });
});
