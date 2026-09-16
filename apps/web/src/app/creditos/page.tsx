"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PRODUCTS, type ProductId } from "@farol/shared";
import { Button } from "@farol/ui";
import { AuthGate } from "../../components/AuthGate";
import { BrandHeader } from "../../components/common/BrandHeader";
import { ApiError } from "../../lib/api-client";
import { getPaymentMe, startCheckout } from "../../lib/payments-api";
import { saveCreditsBefore, saveReturnTo } from "../../lib/return-to";
import "./creditos.css";

const INCLUDED = [
  "destino escolhido com o porquê",
  "roteiro dia a dia",
  "ajustes por conversa, sem limite",
  "voo e hotel indicados"
];

const NOT_CONFIGURED = 503;

function money(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function Creditos({ token }: { token: string }) {
  const params = useSearchParams();
  const [pending, setPending] = useState<ProductId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  // A Stripe não leva estado: o caminho de volta fica guardado aqui.
  useEffect(() => {
    saveReturnTo(params.get("returnTo"));
  }, [params]);

  async function buy(product: ProductId) {
    setPending(product);
    setError(null);
    try {
      const me = await getPaymentMe(token);
      saveCreditsBefore(me.credits);
      const { url } = await startCheckout(token, product);
      window.location.assign(url);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === NOT_CONFIGURED) {
        setClosed(true);
      } else {
        setError(cause instanceof Error ? cause.message : "não consegui abrir a compra");
      }
      setPending(null);
    }
  }

  return (
    <main className="screen">
      <BrandHeader href="/trips">
        <span className="screen__badge">Créditos</span>
        <Link className="screen__back" href="/trips">
          ← Minhas viagens
        </Link>
      </BrandHeader>

      <div className="screen__card">
        <h1 className="screen__title">Sua primeira viagem foi por nossa conta.</h1>
        <p className="screen__sub">
          As próximas custam menos que um café por dia de roteiro — e você só paga pela viagem
          que montar. Sem assinatura.
        </p>

        {closed ? (
          <p className="screen__status" role="status">
            A compra ainda não está aberta. Te avisamos por e-mail assim que abrir.
          </p>
        ) : (
          <div className="creditos__grid">
            {(Object.keys(PRODUCTS) as ProductId[]).map((id) => {
              const product = PRODUCTS[id];
              return (
                <article
                  key={id}
                  className={id === "pack3" ? "creditos__card creditos__card--destaque" : "creditos__card"}
                  aria-label={product.label}
                  data-testid={`plano-${id}`}
                >
                  <div className="creditos__nome">{product.label}</div>
                  <div className="creditos__preco">
                    {money(product.amountCents)}
                    {id === "pack3" ? <small>sem prazo para usar</small> : null}
                  </div>
                  <ul className="creditos__lista">
                    {INCLUDED.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant={id === "pack3" ? "primary" : "ghost"}
                    disabled={pending !== null}
                    loading={pending === id}
                    onClick={() => void buy(id)}
                  >
                    Comprar
                  </Button>
                </article>
              );
            })}
          </div>
        )}

        {error !== null ? (
          <p className="screen__error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="creditos__rodape">
          Arrependeu? Reembolso integral em até 7 dias, se o crédito não foi usado. O pagamento é
          feito na Stripe; não guardamos dados do cartão. <Link href="/termos">Termos</Link> ·{" "}
          <Link href="/privacidade">Privacidade</Link>
        </p>
      </div>
    </main>
  );
}

export default function CreditosPage() {
  return (
    <Suspense>
      <AuthGate>{(token) => <Creditos token={token} />}</AuthGate>
    </Suspense>
  );
}
