"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PaymentMe } from "@farol/shared";
import { getPaymentMe } from "../../lib/payments-api";
import "./credits-badge.css";

export const FREE_LABEL = "1ª viagem por nossa conta";

export function creditsLabel(me: PaymentMe): string {
  if (!me.freeItineraryUsed) {
    return FREE_LABEL;
  }
  return me.credits === 1 ? "1 crédito" : `${me.credits} créditos`;
}

/** Selo do header logado: diz se a 1ª viagem ainda é grátis ou quantos
 *  créditos restam, e leva para a compra. Falha na consulta some em silêncio —
 *  o selo é informação, não um bloqueio. */
export function CreditsBadge({ token }: { token: string }) {
  const [me, setMe] = useState<PaymentMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPaymentMe(token)
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch(() => {
        // sem selo; a tela segue
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (me === null) {
    return null;
  }
  const empty = me.freeItineraryUsed && me.credits === 0;
  return (
    <Link
      className={empty ? "credits-badge credits-badge--empty" : "credits-badge"}
      href="/credits"
      data-testid="credits-badge"
    >
      {creditsLabel(me)}
    </Link>
  );
}
