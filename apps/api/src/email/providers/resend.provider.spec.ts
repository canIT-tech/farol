import { describe, it, expect, vi } from "vitest";
import { ResendEmailProvider } from "./resend.provider";

const message = { to: "ana@farol.app", subject: "Oi", text: "corpo" };

function response(status: number, body = ""): Response {
  return new Response(body, { status });
}

describe("ResendEmailProvider", () => {
  it("faz POST em /emails com bearer, from configurado e o destinatário em lista", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, "{}"));
    const provider = new ResendEmailProvider("re_chave", "Farol <oi@farol.app>", fetchImpl);

    await expect(provider.send(message)).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      authorization: "Bearer re_chave",
      "content-type": "application/json"
    });
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Farol <oi@farol.app>",
      to: ["ana@farol.app"],
      subject: "Oi",
      text: "corpo"
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal!.aborted).toBe(false);
  });

  it("lança com status e começo do corpo quando a Resend recusa", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(422, '{"message":"from inválido"}'));
    const provider = new ResendEmailProvider("re_chave", "oi@farol.app", fetchImpl);

    await expect(provider.send(message)).rejects.toThrow(
      'resend respondeu 422: {"message":"from inválido"}'
    );
  });

  it("corta o corpo do erro em 200 caracteres", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(500, "x".repeat(500)));
    const provider = new ResendEmailProvider("re_chave", "oi@farol.app", fetchImpl);

    await expect(provider.send(message)).rejects.toThrow(`resend respondeu 500: ${"x".repeat(200)}`);
  });

  it("usa o fetch global por padrão", () => {
    const provider = new ResendEmailProvider("re_chave", "oi@farol.app");
    expect(provider).toBeInstanceOf(ResendEmailProvider);
  });
});
