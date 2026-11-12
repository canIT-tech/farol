import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CompanyIdentification } from "./CompanyIdentification";

describe("CompanyIdentification", () => {
  it("mostra a identificação inteira, com o e-mail legível", () => {
    const { container } = render(<CompanyIdentification />);
    expect(container.textContent).toBe(
      "IGNAULIN SOLUCOES TECNOLOGICAS LTDA · CNPJ 49.181.911/0001-51 · contato@ignaulin.com"
    );
  });

  // Com o e-mail inteiro num nó de texto, o Cloudflare o reescreve no HTML e a
  // hidratação do React quebra (#418). Nenhum nó pode conter o e-mail inteiro.
  it("nenhum nó de texto carrega o e-mail inteiro", () => {
    const { container } = render(<CompanyIdentification />);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const texts: string[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode.textContent ?? "");
    expect(texts.some((text) => text.includes("contato@ignaulin.com"))).toBe(false);
  });
});
