import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { orders, users, webhookEvents, type Database } from "@farol/db";
import {
  PRODUCTS,
  PaymentNotConfiguredError,
  type CheckoutResult,
  type CurrentUser,
  type OrderStatus,
  type PaymentMe,
  type ProductId
} from "@farol/shared";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { CreditsService } from "../credits/credits.service";
import { DB } from "../db/db.module";
import { PAYMENT, type PaymentEvent, type PaymentProvider } from "./payment.types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Paid = Extract<PaymentEvent, { type: "paid" }>;
type Refunded = Extract<PaymentEvent, { type: "refunded" }>;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PAYMENT) private readonly provider: PaymentProvider | null,
    @Inject(ENV) private readonly env: Env,
    private readonly credits: CreditsService
  ) {}

  async checkout(user: CurrentUser, product: ProductId): Promise<CheckoutResult> {
    if (this.provider === null) {
      throw new PaymentNotConfiguredError();
    }
    const orderId = crypto.randomUUID();
    const { credits, amountCents } = PRODUCTS[product];
    // A order nasce antes da Session: o webhook precisa de algo para achar.
    // O session id provisório é o próprio orderId, trocado logo abaixo.
    await this.db.insert(orders).values({
      id: orderId,
      userId: user.id,
      providerSessionId: orderId,
      product,
      credits,
      amountCents,
      status: "pending"
    });
    const { url, sessionId } = await this.provider.createCheckout({
      orderId,
      userId: user.id,
      email: user.email,
      product,
      successUrl: `${this.env.APP_URL}/payment/success`,
      cancelUrl: `${this.env.APP_URL}/payment/cancelled`
    });
    await this.db.update(orders).set({ providerSessionId: sessionId }).where(eq(orders.id, orderId));
    return { url };
  }

  async me(userId: string): Promise<PaymentMe> {
    const summary = await this.credits.summary(userId);
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
    return {
      ...summary,
      orders: rows.map((row) => ({
        id: row.id,
        product: row.product as ProductId,
        credits: row.credits,
        amountCents: row.amountCents,
        status: row.status as OrderStatus,
        createdAt: row.createdAt.toISOString()
      }))
    };
  }

  // Idempotente por event.id e seguro fora de ordem: cada transição só
  // acontece "se estava no estado anterior". O crédito entra na mesma
  // transação do registro do evento — um crash entre os dois perderia dinheiro.
  async applyWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (this.provider === null) {
      throw new PaymentNotConfiguredError();
    }
    const event = await this.provider.parseWebhook(rawBody, signature);
    await this.db.transaction(async (tx) => {
      const seen = await tx
        .insert(webhookEvents)
        .values({ id: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ id: webhookEvents.id });
      if (seen.length === 0) {
        return; // replay
      }
      if (event.type === "paid") {
        await this.onPaid(tx, event);
      } else if (event.type === "expired") {
        await tx
          .update(orders)
          .set({ status: "expired" })
          .where(and(eq(orders.providerSessionId, event.sessionId), eq(orders.status, "pending")));
      } else if (event.type === "refunded") {
        await this.onRefunded(tx, event);
      }
    });
  }

  private async onPaid(tx: Tx, event: Paid): Promise<void> {
    const [order] = await tx
      .update(orders)
      .set({ status: "paid", paidAt: sql`now()`, providerPaymentIntent: event.paymentIntent })
      .where(and(eq(orders.providerSessionId, event.sessionId), eq(orders.status, "pending")))
      .returning({ userId: orders.userId, credits: orders.credits });
    if (order) {
      await tx
        .update(users)
        .set({ credits: sql`${users.credits} + ${order.credits}` })
        .where(eq(users.id, order.userId));
    }
  }

  // Créditos já gastos não voltam do usuário: o saldo para no zero (spec §6).
  private async onRefunded(tx: Tx, event: Refunded): Promise<void> {
    const [order] = await tx
      .update(orders)
      .set({ status: "refunded" })
      .where(and(eq(orders.providerPaymentIntent, event.paymentIntent), eq(orders.status, "paid")))
      .returning({ userId: orders.userId, credits: orders.credits });
    if (order) {
      await tx
        .update(users)
        .set({ credits: sql`greatest(0, ${users.credits} - ${order.credits})` })
        .where(eq(users.id, order.userId));
    }
  }
}
