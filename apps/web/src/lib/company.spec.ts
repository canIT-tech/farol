import { describe, it, expect } from "vitest";
import { COMPANY_IDENTIFICATION } from "./company";

// Decreto 7.962/2013, art. 2º, I e II: nome empresarial, CNPJ, endereço físico e
// eletrônico visíveis no site. Se um desses sair, o teste quebra.
describe("COMPANY_IDENTIFICATION", () => {
  it("traz nome empresarial, CNPJ, endereço e e-mail", () => {
    expect(COMPANY_IDENTIFICATION).toContain("IGNAULIN SOLUCOES TECNOLOGICAS LTDA");
    expect(COMPANY_IDENTIFICATION).toContain("CNPJ 49.181.911/0001-51");
    expect(COMPANY_IDENTIFICATION).toContain("Rua Osvaldo Cruz, 1138 E");
    expect(COMPANY_IDENTIFICATION).toContain("contato@ignaulin.com");
  });
});
