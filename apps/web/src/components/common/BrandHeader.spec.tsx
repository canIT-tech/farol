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
});
