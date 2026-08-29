import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DestinationCard, type DestinationCardProps } from "./DestinationCard";

afterEach(cleanup);

const base: DestinationCardProps = {
  city: "Cartagena",
  country: "Colômbia",
  matchValue: 94,
  rationale: "Praia e centro histórico gastronômico. Maio é seco.",
  stats: [
    { label: "Clima", value: "31°" },
    { label: "Voo", value: "5h direto" },
    { label: "Total", value: "R$ 4,1k" }
  ],
  onSeeItinerary: vi.fn(),
  onToggleSave: vi.fn()
};

describe("DestinationCard", () => {
  it("mostra cidade, país, racional e match", () => {
    render(<DestinationCard {...base} />);
    expect(screen.getByRole("heading", { name: "Cartagena" })).toBeInTheDocument();
    expect(screen.getByText("Colômbia")).toBeInTheDocument();
    expect(screen.getByText(/Maio é seco/)).toBeInTheDocument();
    expect(screen.getByLabelText("94% de aderência")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "94");
  });

  it("renderiza os stats", () => {
    render(<DestinationCard {...base} />);
    expect(screen.getByText("Clima")).toBeInTheDocument();
    expect(screen.getByText("5h direto")).toBeInTheDocument();
    expect(screen.getByText("R$ 4,1k")).toBeInTheDocument();
  });

  it("sem photoUrl mostra placeholder rotulado com a cidade", () => {
    render(<DestinationCard {...base} photoUrl={null} />);
    const ph = screen.getByRole("img", { name: "Foto de Cartagena" });
    expect(ph).toHaveTextContent("Cartagena");
    expect(screen.queryByRole("img", { name: "Cartagena, Colômbia" })).not.toBeInTheDocument();
  });

  it("com photoUrl mostra a imagem com alt", () => {
    render(<DestinationCard {...base} photoUrl="https://x/y.jpg" />);
    const img = screen.getByRole("img", { name: "Cartagena, Colômbia" });
    expect(img).toHaveAttribute("src", "https://x/y.jpg");
  });

  it("onSeeItinerary dispara no botão Ver roteiro", async () => {
    const onSee = vi.fn();
    render(<DestinationCard {...base} onSeeItinerary={onSee} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver roteiro" }));
    expect(onSee).toHaveBeenCalledOnce();
  });

  it("onToggleSave dispara no botão salvar; aria-label e aria-pressed seguem saved", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<DestinationCard {...base} onToggleSave={onToggle} />);
    const save = screen.getByRole("button", { name: "Salvar Cartagena" });
    expect(save).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(save);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<DestinationCard {...base} onToggleSave={onToggle} saved />);
    expect(
      screen.getByRole("button", { name: "Remover Cartagena dos salvos" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("featured aplica a classe e sem featured não", () => {
    const { container, rerender } = render(<DestinationCard {...base} featured />);
    expect(container.querySelector(".farol-dcard--featured")).toBeInTheDocument();
    rerender(<DestinationCard {...base} />);
    expect(container.querySelector(".farol-dcard--featured")).not.toBeInTheDocument();
    expect(container.querySelector(".farol-dcard")!.className).not.toContain("false");
  });
});
