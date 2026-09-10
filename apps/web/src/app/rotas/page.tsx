"use client";

import { useState } from "react";
import Link from "next/link";
import "./rotas.css";
import type { FlightOffer, ProviderSection, RouteDeal } from "@farol/shared";
import { AuthGate } from "../../components/AuthGate";
import { BrandHeader } from "../../components/common/BrandHeader";
import { MonthList } from "../../components/routes/MonthList";
import { OfferList } from "../../components/routes/OfferList";
import { RouteForm } from "../../components/routes/RouteForm";
import { getRouteMonths, getRouteOffers } from "../../lib/route-api";
import {
  emptyRouteForm,
  toMonthsInput,
  toOffersInput,
  type RouteFormState
} from "../../lib/route-form";

function Rotas({ token }: { token: string }) {
  const [state, setState] = useState<RouteFormState>(emptyRouteForm());
  const [months, setMonths] = useState<ProviderSection<RouteDeal> | null>(null);
  const [offers, setOffers] = useState<ProviderSection<FlightOffer> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passo 1 e passo 2 numa submissão só: os meses só precisam da rota, e as
  // ofertas só saem se já houver data. Sem data, a tela para no passo 1 e a
  // pessoa escolhe um mês — que preenche a data e dispara o passo 2.
  async function submit(next: RouteFormState = state) {
    const monthsInput = toMonthsInput(next);
    if (monthsInput === null) {
      setError("informe origem e destino com três letras (FLN, SYD)");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setMonths(await getRouteMonths(token, monthsInput));
      const offersInput = toOffersInput(next);
      setOffers(offersInput === null ? null : await getRouteOffers(token, offersInput));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "não consegui buscar essa rota");
    } finally {
      setPending(false);
    }
  }

  function pickMonth(departDate: string) {
    const next = { ...state, depart: departDate };
    setState(next);
    void submit(next);
  }

  return (
    <main className="screen">
      <BrandHeader href="/trips">
        <span className="screen__badge">Busca por rota</span>
        <Link className="screen__back" href="/trips">
          ← Minhas viagens
        </Link>
      </BrandHeader>

      <div className="screen__card">
        <h1 className="screen__title">Quanto custa ir de A a B.</h1>
        <p className="screen__sub">
          Origem e destino quaisquer, pelo código do aeroporto. Sem data, eu mostro em que mês a
          rota sai mais barata; com data, os voos daquele dia.
        </p>

        <RouteForm
          state={state}
          onChange={setState}
          onSubmit={() => void submit()}
          pending={pending}
        />

        {error !== null ? (
          <p className="screen__error" role="alert">
            {error}
          </p>
        ) : null}

        {months !== null ? (
          <section className="rotas__secao">
            <h2>Quando ir</h2>
            <MonthList section={months} onPick={pickMonth} />
          </section>
        ) : null}

        {offers !== null ? (
          <section className="rotas__secao">
            <h2>Voos</h2>
            <OfferList section={offers} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function RotasPage() {
  return <AuthGate>{(token) => <Rotas token={token} />}</AuthGate>;
}
