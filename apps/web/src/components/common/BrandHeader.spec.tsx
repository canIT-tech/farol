import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BrandHeader } from "./BrandHeader";

afterEach(cleanup);

describe("BrandHeader", () => {
  it("mostra a marca", () => {
    render(<BrandHeader />);
    expect(screen.getByText("Farol")).toBeInTheDocument();
  });

  it("mostra o que a tela põe à direita", () => {
    render(
      <BrandHeader>
        <span className="screen__badge">Modo autônomo</span>
      </BrandHeader>
    );
    expect(screen.getByText("Modo autônomo")).toBeInTheDocument();
  });

  it("com href, a marca vira o caminho de volta", () => {
    render(<BrandHeader href="/trips" />);
    const link = screen.getByRole("link", { name: /voltar para minhas viagens/i });
    expect(link).toHaveAttribute("href", "/trips");
  });

  it("sem href, a marca não é link", () => {
    render(<BrandHeader />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
