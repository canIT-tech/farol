import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FlightOfferCard,
  durationLabel,
  localDate,
  localTime,
  routeLabel,
  stopsLabel,
  type FlightOfferCardProps
} from "./FlightOfferCard";

afterEach(cleanup);

const base: FlightOfferCardProps = {
  carrier: "AV",
  carrierName: "Avianca",
  departAt: "2026-05-10T08:15:00-05:00",
  arriveAt: "2026-05-10T13:40:00-05:00",
  originIata: "GRU",
  originName: "São Paulo",
  destinationIata: "CTG",
  destinationName: "Cartagena",
  durationMinutes: 325,
  stops: 0,
  price: "R$ 2.140",
  priceNote: "ida e volta / pessoa",
  deepLink: "https://www.aviasales.com/search/GRU1005CTG17052?marker=555",
  partnerName: "Aviasales",
  onSelect: vi.fn()
};

describe("localTime", () => {
  it("lê a hora local do próprio timestamp, sem converter de fuso", () => {
    expect(localTime("2026-05-10T08:15:00-05:00")).toBe("08:15");
    expect(localTime("2026-05-10T23:40:00Z")).toBe("23:40");
  });

  it("devolve vazio quando não há hora no valor", () => {
    expect(localTime("2026-05-10")).toBe("");
  });
});

describe("localDate", () => {
  it("lê a data local do próprio timestamp, sem converter de fuso", () => {
    expect(localDate("2026-05-10T08:15:00-05:00")).toBe("10 de mai");
    expect(localDate("2026-11-04T23:40:00Z")).toBe("4 de nov");
  });
});

describe("durationLabel", () => {
  it("formata horas e minutos", () => {
    expect(durationLabel(325)).toBe("5h 25");
    expect(durationLabel(120)).toBe("2h");
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(0)).toBe("0 min");
  });
});

describe("stopsLabel", () => {
  it("distingue direto, uma escala e várias", () => {
    expect(stopsLabel(0)).toBe("Direto");
    expect(stopsLabel(1)).toBe("1 escala");
    expect(stopsLabel(3)).toBe("3 escalas");
  });
});

describe("routeLabel", () => {
  it("junta código e nome dos dois lados", () => {
    expect(routeLabel("GRU", "São Paulo", "CTG", "Cartagena")).toBe(
      "GRU São Paulo → CTG Cartagena"
    );
  });

  it("mostra só o código quando o nome não está no catálogo", () => {
    expect(routeLabel("GRU", null, "CTG", null)).toBe("GRU → CTG");
    expect(routeLabel("GRU", "São Paulo", "CTG", null)).toBe("GRU São Paulo → CTG");
  });
});

describe("FlightOfferCard", () => {
  it("mostra companhia, horários, rota, duração, escalas e preço", () => {
    render(<FlightOfferCard {...base} />);

    expect(screen.getByText("AV")).toBeInTheDocument();
    expect(screen.getByText("08:15 → 13:40")).toBeInTheDocument();
    // A data entra no cartão: a oferta é cache do parceiro e pode cair fora das
    // datas da viagem — sem ela, "08:15 → 13:40" não diz de que dia é.
    expect(screen.getByText("Avianca · 10 de mai · GRU São Paulo → CTG Cartagena")).toBeInTheDocument();
    expect(screen.getByText("5h 25")).toBeInTheDocument();
    expect(screen.getByText("Direto")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.140")).toBeInTheDocument();
    expect(screen.getByText("ida e volta / pessoa")).toBeInTheDocument();
  });

  it("aponta o link do parceiro em nova aba, dizendo qual é", () => {
    render(<FlightOfferCard {...base} />);
    const link = screen.getByRole("link", { name: "abre no Aviasales ↗" });
    expect(link).toHaveAttribute("href", base.deepLink);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("cai no código quando a companhia não está no catálogo", () => {
    render(<FlightOfferCard {...base} carrierName={null} />);
    expect(screen.getByText("10 de mai · GRU São Paulo → CTG Cartagena")).toBeInTheDocument();
  });

  it("omite a duração quando o provider não informou", () => {
    render(<FlightOfferCard {...base} durationMinutes={0} />);
    expect(screen.queryByText("0 min")).not.toBeInTheDocument();
    expect(screen.getByText("Direto")).toBeInTheDocument();
  });

  it("mostra o número de escalas quando não é direto", () => {
    render(<FlightOfferCard {...base} stops={2} />);
    expect(screen.getByText("2 escalas")).toBeInTheDocument();
  });

  it("chama onSelect no clique e desabilita enquanto ocupado", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<FlightOfferCard {...base} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Selecionar" }));
    expect(onSelect).toHaveBeenCalledOnce();

    rerender(<FlightOfferCard {...base} onSelect={onSelect} busy />);
    expect(screen.getByRole("button", { name: "Selecionar" })).toBeDisabled();
  });

  it("destaca a recomendação e mantém o rótulo acessível com o preço", () => {
    const { container } = render(<FlightOfferCard {...base} best />);
    expect(container.querySelector(".farol-flight--best")).not.toBeNull();
    expect(
      screen.getByRole("article", { name: "Avianca, GRU São Paulo → CTG Cartagena, R$ 2.140" })
    ).toBeInTheDocument();
  });

  it("usa o código no rótulo acessível quando não há nome de companhia", () => {
    render(<FlightOfferCard {...base} carrierName={null} originName={null} destinationName={null} />);
    expect(screen.getByRole("article", { name: "AV, GRU → CTG, R$ 2.140" })).toBeInTheDocument();
  });
});
