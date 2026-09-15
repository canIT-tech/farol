import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { CreditsBadge, creditsLabel, FREE_LABEL } from "./CreditsBadge";

const getPaymentMe = vi.hoisted(() => vi.fn());
vi.mock("../../lib/payments-api", () => ({ getPaymentMe }));

afterEach(() => {
  cleanup();
  getPaymentMe.mockReset();
});

describe("creditsLabel", () => {
  it("antes do 1º roteiro diz que a viagem é por nossa conta, independente do saldo", () => {
    expect(creditsLabel({ credits: 3, freeItineraryUsed: false, orders: [] })).toBe(FREE_LABEL);
  });

  it("depois do grátis conta os créditos, no singular e no plural", () => {
    expect(creditsLabel({ credits: 1, freeItineraryUsed: true, orders: [] })).toBe("1 crédito");
    expect(creditsLabel({ credits: 2, freeItineraryUsed: true, orders: [] })).toBe("2 créditos");
    expect(creditsLabel({ credits: 0, freeItineraryUsed: true, orders: [] })).toBe("0 créditos");
  });
});

describe("CreditsBadge", () => {
  it("mostra o selo como link para /creditos", async () => {
    getPaymentMe.mockResolvedValue({ credits: 2, freeItineraryUsed: true, orders: [] });
    render(<CreditsBadge token="tok" />);
    const badge = await screen.findByTestId("credits-badge");
    expect(badge).toHaveTextContent("2 créditos");
    expect(badge).toHaveAttribute("href", "/creditos");
    expect(badge).not.toHaveClass("credits-badge--empty");
    expect(getPaymentMe).toHaveBeenCalledWith("tok");
  });

  it("saldo zero depois do grátis fica marcado como vazio", async () => {
    getPaymentMe.mockResolvedValue({ credits: 0, freeItineraryUsed: true, orders: [] });
    render(<CreditsBadge token="tok" />);
    expect(await screen.findByTestId("credits-badge")).toHaveClass("credits-badge--empty");
  });

  it("falha na consulta não renderiza nada nem quebra a tela", async () => {
    getPaymentMe.mockRejectedValue(new Error("api caiu"));
    render(<CreditsBadge token="tok" />);
    await waitFor(() => expect(getPaymentMe).toHaveBeenCalled());
    expect(screen.queryByTestId("credits-badge")).toBeNull();
  });

  it("resposta que chega depois de desmontar é ignorada", async () => {
    let resolve: (me: unknown) => void = () => {};
    getPaymentMe.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = render(<CreditsBadge token="tok" />);
    unmount();
    resolve({ credits: 1, freeItineraryUsed: true, orders: [] });
    await Promise.resolve();
    expect(screen.queryByTestId("credits-badge")).toBeNull();
  });
});
