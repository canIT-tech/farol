import { describe, it, expect } from "vitest";
import { fillTemplate } from "./template.js";

describe("fillTemplate", () => {
  it("substitui os placeholders conhecidos", () => {
    expect(fillTemplate("a/{x}/b/{y}", { x: "1", y: "2" })).toBe("a/1/b/2");
  });

  it("troca placeholder desconhecido por string vazia", () => {
    expect(fillTemplate("a/{x}/b/{z}", { x: "1" })).toBe("a/1/b/");
  });

  it("devolve o template intacto quando não há placeholder", () => {
    expect(fillTemplate("https://x.example.com", { x: "1" })).toBe("https://x.example.com");
  });
})
