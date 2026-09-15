import { describe, it, expect, vi } from "vitest";
import type { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";

const user = { id: "u-1", email: "u@farol.test" };

function controllerWith() {
  const payments = {
    checkout: vi.fn().mockResolvedValue({ url: "https://checkout/x" }),
    me: vi.fn().mockResolvedValue({ credits: 1, freeItineraryUsed: true, orders: [] }),
    applyWebhook: vi.fn().mockResolvedValue(undefined)
  };
  return { payments, controller: new PaymentsController(payments as unknown as PaymentsService) };
}

describe("PaymentsController", () => {
  it("checkout repassa usuário e produto", async () => {
    const { payments, controller } = controllerWith();
    await expect(controller.checkout(user, { product: "pack3" })).resolves.toEqual({
      url: "https://checkout/x"
    });
    expect(payments.checkout).toHaveBeenCalledWith(user, "pack3");
  });

  it("me consulta pelo id do usuário", async () => {
    const { payments, controller } = controllerWith();
    await controller.me(user);
    expect(payments.me).toHaveBeenCalledWith("u-1");
  });

  it("webhook entrega o corpo cru e a assinatura, e responde received", async () => {
    const { payments, controller } = controllerWith();
    const rawBody = Buffer.from("{}");
    await expect(controller.webhook({ rawBody }, "t=1,v1=abc")).resolves.toEqual({ received: true });
    expect(payments.applyWebhook).toHaveBeenCalledWith(rawBody, "t=1,v1=abc");
  });

  it("webhook sem corpo cru e sem header manda buffer vazio e assinatura vazia", async () => {
    const { payments, controller } = controllerWith();
    await controller.webhook({});
    const [body, signature] = payments.applyWebhook.mock.calls[0]!;
    expect(Buffer.isBuffer(body) && body.length).toBe(0);
    expect(signature).toBe("");
  });
});
