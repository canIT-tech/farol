import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FlightOffer, HotelOffer } from "@farol/shared";
import { FlightSection, HotelSection, durationLabel, stopsLabel } from "./OfferSections";

const voo: FlightOffer = {
  id: "f1",
  price: 3200,
  currency: "BRL",
  carrier: "TAP",
  stops: 0,
  departAt: "2026-09-10T22:00:00Z",
  arriveAt: "2026-09-11T10:00:00Z",
  returnAt: "2026-09-17T12:00:00Z",
  durationMinutes: 615,
  deepLink: "https://exemplo.test/voo"
};

const hotel: HotelOffer = {
  id: "h1",
  name: "Hotel do Chiado",
  region: "Chiado",
  pricePerNight: 480,
  priceTotal: 3360,
  currency: "BRL",
  rating: 4.5,
  deepLink: "https://exemplo.test/hotel"
};

describe("durationLabel", () => {
  it("formata horas cheias e com minutos", () => {
    expect(durationLabel(600)).toBe("10h");
    expect(durationLabel(615)).toBe("10h15");
    expect(durationLabel(605)).toBe("10h05");
  });
});

describe("stopsLabel", () => {
  it("cobre direto, uma e várias paradas", () => {
    expect(stopsLabel(0)).toBe("direto");
    expect(stopsLabel(1)).toBe("1 parada");
    expect(stopsLabel(2)).toBe("2 paradas");
  });
});

describe("FlightSection", () => {
  it("provider fora do ar vira aviso, não tela quebrada", () => {
    render(
      <FlightSection
        section={{ offers: [], stale: false, error: "unavailable" }}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Não consegui consultar agora");
  });

  it("sem ofertas mostra o vazio próprio", () => {
    render(
      <FlightSection section={{ offers: [], stale: false, error: null }} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum voo encontrado");
  });

  it("lista a oferta com preço, duração e paradas", () => {
    render(
      <FlightSection section={{ offers: [voo], stale: false, error: null }} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("heading", { name: "TAP" })).toBeInTheDocument();
    expect(screen.getByText("10h15 · direto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver no site" })).toHaveAttribute(
      "href",
      "https://exemplo.test/voo"
    );
  });

  it("avisa quando o preço veio do cache", () => {
    render(
      <FlightSection section={{ offers: [voo], stale: true, error: null }} onSelect={vi.fn()} />
    );
    expect(screen.getByText("Preços de alguns minutos atrás.")).toBeInTheDocument();
  });

  it("escolher devolve o id da oferta", async () => {
    const onSelect = vi.fn();
    render(
      <FlightSection section={{ offers: [voo], stale: false, error: null }} onSelect={onSelect} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Escolher" }));
    expect(onSelect).toHaveBeenCalledWith("f1");
  });

  it("busy bloqueia a escolha", () => {
    render(
      <FlightSection section={{ offers: [voo], stale: false, error: null }} onSelect={vi.fn()} busy />
    );
    expect(screen.getByRole("button", { name: "Escolher" })).toBeDisabled();
  });
});

describe("HotelSection", () => {
  it("provider fora do ar vira aviso", () => {
    render(
      <HotelSection section={{ offers: [], stale: false, error: "unavailable" }} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Não consegui consultar agora");
  });

  it("sem ofertas mostra o vazio próprio", () => {
    render(<HotelSection section={{ offers: [], stale: false, error: null }} onSelect={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhuma hospedagem encontrada");
  });

  it("lista nome, região, diária, total e nota", () => {
    render(
      <HotelSection section={{ offers: [hotel], stale: false, error: null }} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("heading", { name: "Hotel do Chiado" })).toBeInTheDocument();
    expect(screen.getByText("Chiado")).toBeInTheDocument();
    expect(screen.getByText("Nota 4.5")).toBeInTheDocument();
  });

  it("omite região e nota quando não vieram", () => {
    render(
      <HotelSection
        section={{ offers: [{ ...hotel, region: null, rating: null }], stale: false, error: null }}
        onSelect={vi.fn()}
      />
    );
    expect(screen.queryByText("Chiado")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Nota/)).not.toBeInTheDocument();
  });

  it("escolher devolve o id da oferta", async () => {
    const onSelect = vi.fn();
    render(
      <HotelSection section={{ offers: [hotel], stale: false, error: null }} onSelect={onSelect} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Escolher" }));
    expect(onSelect).toHaveBeenCalledWith("h1");
  });

  it("busy bloqueia a escolha", () => {
    render(
      <HotelSection
        section={{ offers: [hotel], stale: false, error: null }}
        onSelect={vi.fn()}
        busy
      />
    );
    expect(screen.getByRole("button", { name: "Escolher" })).toBeDisabled();
  });
});
