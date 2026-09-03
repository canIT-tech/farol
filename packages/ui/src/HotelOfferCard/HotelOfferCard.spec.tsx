import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  HotelOfferCard,
  areaLabel,
  ratingLabel,
  type HotelOfferCardProps
} from "./HotelOfferCard";

afterEach(cleanup);

const base: HotelOfferCardProps = {
  name: "Casa del Arzobispado",
  region: "Centro Histórico",
  walkingNote: "4 paradas a pé",
  photoUrl: "https://static.cupid.travel/hotels/1.jpg",
  rating: 4.7,
  pricePerNight: "R$ 320",
  deepLink: "https://parceiro.example.com/hotel",
  onSelect: vi.fn()
};

describe("areaLabel", () => {
  it("junta área e distância com separador", () => {
    expect(areaLabel("Chiado", "4 paradas a pé")).toBe("Chiado · 4 paradas a pé");
  });

  it("mostra só o que existe", () => {
    expect(areaLabel("Chiado", null)).toBe("Chiado");
    expect(areaLabel(null, "4 paradas a pé")).toBe("4 paradas a pé");
    expect(areaLabel("", "4 paradas a pé")).toBe("4 paradas a pé");
  });

  it("devolve null quando não há nem área nem distância", () => {
    expect(areaLabel(null, null)).toBeNull();
    expect(areaLabel("", "")).toBeNull();
  });
});

describe("ratingLabel", () => {
  it("formata a nota com uma casa e a estrela", () => {
    expect(ratingLabel(4.7)).toBe("4.7 ★");
    expect(ratingLabel(5)).toBe("5.0 ★");
  });

  it("devolve null sem nota — hotel sem avaliação não vira '0 ★'", () => {
    expect(ratingLabel(null)).toBeNull();
  });
});

describe("HotelOfferCard", () => {
  it("mostra nome, área, nota, diária e a foto do hotel", () => {
    render(<HotelOfferCard {...base} />);

    expect(screen.getByRole("heading", { name: "Casa del Arzobispado" })).toBeInTheDocument();
    expect(screen.getByText("Centro Histórico · 4 paradas a pé")).toBeInTheDocument();
    expect(screen.getByText("4.7 ★")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 320/)).toBeInTheDocument();
    expect(screen.getByText("/noite")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto do Casa del Arzobispado" })).toHaveAttribute(
      "src",
      base.photoUrl
    );
  });

  it("hotel sem foto ganha um bloco neutro, nunca a imagem de outro", () => {
    const { container } = render(<HotelOfferCard {...base} photoUrl={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector(".farol-hcard__photo--empty")).not.toBeNull();
  });

  it("omite a linha de área quando não há região nem distância", () => {
    render(<HotelOfferCard {...base} region={null} walkingNote={null} />);
    expect(screen.queryByText(/paradas a pé/)).not.toBeInTheDocument();
  });

  it("aponta o link do parceiro em nova aba", () => {
    render(<HotelOfferCard {...base} />);
    const link = screen.getByRole("link", { name: "Ver no parceiro" });
    expect(link).toHaveAttribute("href", base.deepLink);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("aceita outro rótulo para o link do parceiro", () => {
    render(<HotelOfferCard {...base} partnerLabel="Ver na Booking" />);
    expect(screen.getByRole("link", { name: "Ver na Booking" })).toBeInTheDocument();
  });

  it("chama onSelect no clique e desabilita enquanto ocupado", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<HotelOfferCard {...base} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Escolher" }));
    expect(onSelect).toHaveBeenCalledOnce();

    rerender(<HotelOfferCard {...base} onSelect={onSelect} busy />);
    expect(screen.getByRole("button", { name: "Escolher" })).toBeDisabled();
  });

  it("nomeia o cartão pelo hotel e pela diária, para leitor de tela", () => {
    render(<HotelOfferCard {...base} rating={null} />);
    expect(
      screen.getByRole("article", { name: "Casa del Arzobispado, R$ 320 por noite" })
    ).toBeInTheDocument();
  });
});
