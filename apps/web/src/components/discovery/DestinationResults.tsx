"use client";

import { useState } from "react";
import { Chip, DestinationCard } from "@farol/ui";
import type { DestinationCandidate } from "@farol/shared";
import { arrangeDestinations, type DestinationSort } from "../../lib/destination-filters";

function money(value: number, currency: string): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 });
}

// Só entram estatísticas com dado real. Clima está fixo em 22 °C no back e
// flightTimeHours vem sempre null (item D1 do plano de consolidação) — exibir
// qualquer um dos dois seria inventar número para o usuário.
function stats(candidate: DestinationCandidate) {
  const { estCost } = candidate;
  return [
    { label: "Voo estimado", value: money(estCost.flight, estCost.currency) },
    { label: "Diária", value: money(estCost.lodgingPerNight, estCost.currency) },
    { label: "Por dia no destino", value: money(estCost.dailyLocal, estCost.currency) }
  ];
}

export function DestinationResults({
  destinations,
  onChoose
}: {
  destinations: DestinationCandidate[];
  onChoose: (iata: string) => void;
}) {
  const [domesticOnly, setDomesticOnly] = useState(false);
  const [sort, setSort] = useState<DestinationSort>("match");
  const [saved, setSaved] = useState<string[]>([]);

  const arranged = arrangeDestinations(destinations, { domesticOnly, sort });

  if (destinations.length === 0) {
    return <p role="status">Nenhum destino combinou com o que você pediu.</p>;
  }

  return (
    <div>
      <div role="group" aria-label="Filtros">
        <Chip selected={domesticOnly} onClick={() => setDomesticOnly((v) => !v)}>
          Só nacional
        </Chip>
        <Chip
          selected={sort === "price"}
          onClick={() => setSort((s) => (s === "price" ? "match" : "price"))}
        >
          Menor preço
        </Chip>
      </div>

      {arranged.length === 0 ? (
        <p role="status">Nenhum destino nacional entre os candidatos.</p>
      ) : (
        <ul>
          {arranged.map((candidate, index) => (
            <li key={candidate.iata}>
              <DestinationCard
                city={candidate.city}
                country={candidate.country}
                matchValue={candidate.score}
                rationale={candidate.rationale}
                stats={stats(candidate)}
                featured={index === 0}
                saved={saved.includes(candidate.iata)}
                onSeeItinerary={() => onChoose(candidate.iata)}
                onToggleSave={() =>
                  setSaved((current) =>
                    current.includes(candidate.iata)
                      ? current.filter((iata) => iata !== candidate.iata)
                      : [...current, candidate.iata]
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
