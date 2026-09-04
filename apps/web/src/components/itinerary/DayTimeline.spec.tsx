import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ItineraryDay, ItineraryItem } from "@farol/shared";
import { DayStrip, DayTimeline, ItineraryItemCard } from "./DayTimeline";

function item(over: Partial<ItineraryItem> & Pick<ItineraryItem, "id">): ItineraryItem {
  return {
    slot: "morning",
    type: "activity",
    title: "Passeio pela Alfama",
    description: null,
    placeId: null,
    lat: null,
    lng: null,
    rating: null,
    durationMin: null,
    estCost: null,
    sortOrder: 0,
    pinned: false,
    needsReview: false,
    ...over
  };
}

function day(over: Partial<ItineraryDay> & Pick<ItineraryDay, "id" | "dayIndex">): ItineraryDay {
  return { date: null, notes: null, items: [], ...over };
}

const almoco = item({ id: "22222222-2222-4222-8222-222222222222", type: "meal", slot: "afternoon", title: "Tasca do Zé" });

describe("DayStrip", () => {
  const days = [
    day({ id: "d1", dayIndex: 1 }),
    day({ id: "d2", dayIndex: 2 })
  ];

  it("mostra um chip por dia", () => {
    render(<DayStrip days={days} activeIndex={1} onSelect={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Dia 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dia 2" })).toBeInTheDocument();
  });

  it("mostra a data curta quando o dia tem uma", () => {
    render(
      <DayStrip
        days={[day({ id: "d1", dayIndex: 1, date: "2026-05-10" })]}
        activeIndex={1}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("10 mai")).toBeInTheDocument();
  });

  it("dia sem data mostra só o número", () => {
    render(<DayStrip days={days} activeIndex={1} onSelect={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Dia 1" })).toHaveTextContent(/^Dia 1$/);
  });

  it("seleciona o dia clicado", async () => {
    const onSelect = vi.fn();
    render(<DayStrip days={days} activeIndex={1} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("tab", { name: "Dia 2" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});

describe("ItineraryItemCard", () => {
  it("mostra o título do item", () => {
    render(<ItineraryItemCard item={item({ id: "a" })} />);
    expect(screen.getByRole("heading", { name: "Passeio pela Alfama" })).toBeInTheDocument();
  });

  it("mostra descrição e nota quando existem", () => {
    render(<ItineraryItemCard item={item({ id: "a", description: "Bairro antigo", rating: 4.6 })} />);
    expect(screen.getByText("Bairro antigo")).toBeInTheDocument();
    expect(screen.getByText("4.6 ★")).toBeInTheDocument();
  });

  it("marca item fixado", () => {
    render(<ItineraryItemCard item={item({ id: "a", pinned: true })} />);
    expect(screen.getByText("Fixado")).toBeInTheDocument();
  });

  it("marca item que o enrich não achou", () => {
    render(<ItineraryItemCard item={item({ id: "a", needsReview: true })} />);
    expect(screen.getByText("A conferir")).toBeInTheDocument();
  });

  it("trocar restaurante só aparece em refeição", () => {
    const { rerender } = render(<ItineraryItemCard item={item({ id: "a" })} onSwapRestaurant={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Trocar restaurante" })).not.toBeInTheDocument();
    rerender(<ItineraryItemCard item={almoco} onSwapRestaurant={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Trocar restaurante" })).toBeInTheDocument();
  });

  it("sem handler, refeição não oferece a troca", () => {
    render(<ItineraryItemCard item={almoco} />);
    expect(screen.queryByRole("button", { name: "Trocar restaurante" })).not.toBeInTheDocument();
  });

  it("trocar restaurante devolve o id do item", async () => {
    const onSwap = vi.fn();
    render(<ItineraryItemCard item={almoco} onSwapRestaurant={onSwap} />);
    await userEvent.click(screen.getByRole("button", { name: "Trocar restaurante" }));
    expect(onSwap).toHaveBeenCalledWith(almoco.id);
  });
});

describe("DayTimeline", () => {
  const cheio = day({
    id: "d1",
    dayIndex: 1,
    items: [item({ id: "11111111-1111-4111-8111-111111111111" }), almoco]
  });

  it("usa a data quando existe e o índice quando não", () => {
    const { rerender } = render(
      <DayTimeline day={cheio} onRegenerateDay={vi.fn()} onSwapRestaurant={vi.fn()} />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Dia 1" })).toBeInTheDocument();
    rerender(
      <DayTimeline
        day={{ ...cheio, date: "2026-09-10" }}
        onRegenerateDay={vi.fn()}
        onSwapRestaurant={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "2026-09-10" })).toBeInTheDocument();
  });

  it("lista os itens do dia", () => {
    render(<DayTimeline day={cheio} onRegenerateDay={vi.fn()} onSwapRestaurant={vi.fn()} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("dia sem item avisa que está livre", () => {
    render(
      <DayTimeline day={day({ id: "d9", dayIndex: 9 })} onRegenerateDay={vi.fn()} onSwapRestaurant={vi.fn()} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Este dia está livre");
  });

  it("refazer o dia devolve o índice", async () => {
    const onRegenerate = vi.fn();
    render(<DayTimeline day={cheio} onRegenerateDay={onRegenerate} onSwapRestaurant={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Refazer o dia" }));
    expect(onRegenerate).toHaveBeenCalledWith(1);
  });

  it("busy bloqueia refazer o dia", () => {
    render(<DayTimeline day={cheio} onRegenerateDay={vi.fn()} onSwapRestaurant={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Refazer o dia" })).toBeDisabled();
  });
});
