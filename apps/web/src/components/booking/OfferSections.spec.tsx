import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FlightOffer, HotelOffer, ItineraryItem, ProviderSection } from "@farol/shared";
import {
  APPROX_PRICE_NOTICE,
  FLIGHT_PARTNER,
  FlightSection,
  HotelSection,
  freshnessLabel
} from "./OfferSections";

afterEach(cleanup);

const voo: FlightOffer = {
  id: "f1",
  price: 3200,
  currency: "BRL",
  carrier: "TP",
  carrierName: "TAP Air Portugal",
  originIata: "GRU",
  originName: "São Paulo",
  destinationIata: "LIS",
  destinationName: "Lisboa",
  stops: 0,
  departAt: "2026-09-10T22:00:00-03:00",
  arriveAt: "2026-09-11T10:00:00+01:00",
  returnAt: "2026-09-17T12:00:00+01:00",
  durationMinutes: 615,
  deepLink: "https://www.aviasales.com/search/GRU1009LIS17092?marker=555"
};

const soIda: FlightOffer = { ...voo, id: "f2", price: 1900, returnAt: null };

const hotel: HotelOffer = {
  id: "h1",
  name: "Hotel do Chiado",
  region: "Chiado",
  address: "R. Nova do Almada 114",
  pricePerNight: 480,
  priceTotal: 3360,
  currency: "BRL",
  rating: 4.5,
  reviewCount: 1280,
  stars: 4,
  photoUrl: "https://static.cupid.travel/hotels/1.jpg",
  lat: 38.7107,
  lng: -9.1401,
  deepLink: "https://exemplo.test/hotel"
};

const parada = (lat: number, lng: number): ItineraryItem =>
  ({ id: `i-${lat}`, lat, lng }) as unknown as ItineraryItem;

function section<T>(offers: T[], over: Partial<ProviderSection<T>> = {}): ProviderSection<T> {
  return { offers, stale: false, fetchedAt: null, error: null, ...over };
}

describe("freshnessLabel", () => {
  const now = Date.parse("2026-09-02T12:00:00Z");

  it("diz agora, minutos e horas conforme a idade do preço", () => {
    expect(freshnessLabel("2026-09-02T11:59:40Z", now)).toBe("Preços consultados agora.");
    expect(freshnessLabel("2026-09-02T11:52:00Z", now)).toBe("Preços de 8 min atrás.");
    expect(freshnessLabel("2026-09-02T11:00:00Z", now)).toBe("Preços de 1 hora atrás.");
    expect(freshnessLabel("2026-09-02T09:00:00Z", now)).toBe("Preços de 3 horas atrás.");
  });

  it("nunca mostra idade negativa quando o relógio do cliente está atrasado", () => {
    expect(freshnessLabel("2026-09-02T12:05:00Z", now)).toBe("Preços consultados agora.");
  });

  it("devolve null sem data e com data inválida", () => {
    expect(freshnessLabel(null, now)).toBeNull();
    expect(freshnessLabel("ontem", now)).toBeNull();
  });
});

describe("FlightSection", () => {
  it("mostra a oferta no formato do hi-fi: horários, rota, duração e preço", () => {
    render(<FlightSection section={section([voo])} onSelect={vi.fn()} />);

    expect(screen.getByText("22:00 → 10:00")).toBeInTheDocument();
    expect(screen.getByText("TAP Air Portugal · GRU São Paulo → LIS Lisboa")).toBeInTheDocument();
    expect(screen.getByText("10h 15")).toBeInTheDocument();
    expect(screen.getByText("Direto")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.200")).toBeInTheDocument();
    expect(screen.getByText("ida e volta / pessoa")).toBeInTheDocument();
  });

  it("distingue só ida de ida e volta", () => {
    render(<FlightSection section={section([soIda])} onSelect={vi.fn()} />);
    expect(screen.getByText("só ida / pessoa")).toBeInTheDocument();
  });

  it("nomeia o parceiro que recebe o clique", () => {
    render(<FlightSection section={section([voo])} onSelect={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: `abre no ${FLIGHT_PARTNER} ↗` })
    ).toHaveAttribute("href", voo.deepLink);
  });

  it("avisa que o preço é aproximado, com a idade quando o back informa", () => {
    const { rerender } = render(<FlightSection section={section([voo])} onSelect={vi.fn()} />);
    expect(screen.getByRole("note")).toHaveTextContent(APPROX_PRICE_NOTICE);

    rerender(
      <FlightSection
        section={section([voo], { fetchedAt: new Date(Date.now() - 480_000).toISOString() })}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("note")).toHaveTextContent("Preços de 8 min atrás.");
  });

  it("marca a primeira oferta como recomendação", () => {
    const { container } = render(
      <FlightSection section={section([voo, soIda])} onSelect={vi.fn()} />
    );
    const cards = container.querySelectorAll(".farol-flight");
    expect(cards[0]!.className).toContain("farol-flight--best");
    expect(cards[1]!.className).not.toContain("farol-flight--best");
  });

  it("chama onSelect com o id da oferta clicada", async () => {
    const onSelect = vi.fn();
    render(<FlightSection section={section([voo, soIda])} onSelect={onSelect} />);

    const segunda = screen.getAllByRole("article")[1]!;
    await userEvent.click(within(segunda).getByRole("button", { name: "Selecionar" }));
    expect(onSelect).toHaveBeenCalledWith("f2");
  });

  it("desabilita a seleção enquanto uma escolha está em curso", () => {
    render(<FlightSection section={section([voo])} onSelect={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Selecionar" })).toBeDisabled();
  });

  it("aceita título e vazio próprios — é o mesmo componente dos aeroportos vizinhos", () => {
    render(
      <FlightSection
        section={section([])}
        onSelect={vi.fn()}
        title="Aeroportos vizinhos"
        empty="Nada por perto."
      />
    );
    expect(screen.getByRole("region", { name: "Aeroportos vizinhos" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nada por perto.");
  });

  it("provider fora do ar vira aviso, não tela de erro", () => {
    render(
      <FlightSection section={section([], { error: "unavailable" })} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Não consegui consultar agora.");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("seção vazia sem erro mostra o texto de vazio padrão", () => {
    render(<FlightSection section={section([])} onSelect={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum voo encontrado para estas datas.");
  });
});

describe("HotelSection", () => {
  it("mostra o cartão hi-fi: foto, nome, área, nota e diária", () => {
    render(<HotelSection section={section([hotel])} onSelect={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Hotel do Chiado" })).toBeInTheDocument();
    expect(screen.getByText("Chiado")).toBeInTheDocument();
    expect(screen.getByText("4.5 ★")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 480/)).toBeInTheDocument();
    expect(screen.getByText("/noite")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto do Hotel do Chiado" })).toBeInTheDocument();
  });

  it("conta as paradas do roteiro que ficam a pé do hotel", () => {
    render(
      <HotelSection
        section={section([hotel])}
        onSelect={vi.fn()}
        itineraryItems={[parada(38.7108, -9.1402), parada(38.7112, -9.1405), parada(38.9, -9.5)]}
      />
    );
    expect(screen.getByText("Chiado · 2 paradas a pé")).toBeInTheDocument();
  });

  it("sem roteiro carregado mostra só a área", () => {
    render(<HotelSection section={section([hotel])} onSelect={vi.fn()} />);
    expect(screen.getByText("Chiado")).toBeInTheDocument();
    expect(screen.queryByText(/paradas a pé/)).not.toBeInTheDocument();
  });

  it("avisa que o preço é aproximado", () => {
    render(<HotelSection section={section([hotel])} onSelect={vi.fn()} />);
    expect(screen.getByRole("note")).toHaveTextContent(APPROX_PRICE_NOTICE);
  });

  it("chama onSelect e respeita busy", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<HotelSection section={section([hotel])} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Escolher" }));
    expect(onSelect).toHaveBeenCalledWith("h1");

    rerender(<HotelSection section={section([hotel])} onSelect={onSelect} busy />);
    expect(screen.getByRole("button", { name: "Escolher" })).toBeDisabled();
  });

  it("degrada e mostra vazio como a seção de voo", () => {
    const { rerender } = render(
      <HotelSection section={section([], { error: "unavailable" })} onSelect={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Não consegui consultar agora.");

    rerender(<HotelSection section={section([])} onSelect={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nenhuma hospedagem encontrada para estas datas."
    );
  });
});
