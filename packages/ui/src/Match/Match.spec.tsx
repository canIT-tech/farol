import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MatchBadge, MatchBar } from "./Match";

afterEach(cleanup);

describe("MatchBadge", () => {
  it("mostra o valor e o aria-label", () => {
    render(<MatchBadge value={94} />);
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByLabelText("94% de aderência")).toBeInTheDocument();
  });

  it("arredonda e faz clamp em [0, 100]", () => {
    const { rerender } = render(<MatchBadge value={87.6} />);
    expect(screen.getByText("88%")).toBeInTheDocument();
    rerender(<MatchBadge value={150} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    rerender(<MatchBadge value={-5} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("MatchBar", () => {
  it("é progressbar com aria-valuenow = valor clampado", () => {
    render(<MatchBar value={85} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "85");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("largura do preenchimento = valor%", () => {
    const { container } = render(<MatchBar value={40} />);
    expect(container.querySelector(".farol-match-bar__fill")).toHaveStyle({ width: "40%" });
  });

  it("clamp acima de 100 e abaixo de 0", () => {
    const { rerender, container } = render(<MatchBar value={120} />);
    expect(container.querySelector(".farol-match-bar__fill")).toHaveStyle({ width: "100%" });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<MatchBar value={-1} />);
    expect(container.querySelector(".farol-match-bar__fill")).toHaveStyle({ width: "0%" });
  });
});
