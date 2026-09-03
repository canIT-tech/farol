"use client";

import { useState } from "react";
import { Chip, DestinationCard } from "@farol/ui";
import type { DestinationCandidate } from "@farol/shared";
import { arrangeDestinations, type DestinationSort } from "../../lib/destination-filters";
import { money } from "../../lib/money";

export function stopsLabel(stops: number): string {
  if (stops === 0) {
    return "direto";
  }
  return stops === 1 ? "1 escala" : `${stops} escalas`;
}

// Só entram estatísticas com dado real. Clima e flightTimeHours seguem sem
// fonte no MVP — exibir qualquer um dos dois seria inventar número. As escalas
// vêm do provider de voo (city-directions) e entram só quando ele cobriu a rota.
function stats(candidate: DestinationCandidate) {
  const { estCost } = candidate;
  const base = [
    { label: "Voo estimado", value: money(estCost.flight, estCost.currency) },
    { label: "Diária", value: money(estCost.lodgingPerNight, estCost.currency) },
    { label: "Por dia no destino", value: money(estCost.dailyLocal, estCost.currency) }
  ];
  if (candidate.flightStops === null) {
    return base;
  }
  return [{ label: "Voo", value: stopsLabel(candidate.flightStops) }, ...base];
}

export function DestinationResults({
  destinations,
  onChoose
}: {
  destinations: DestinationCandidate[];
  onChoose: (iata: string) => void;
}) {
  const [domesticOnly, setDomesticOnly] = useState(false);
  const [nonStopOnly, setNonStopOnly] = useState(false);
  const [sort, setSort] = useState<DestinationSort>("match");
  const [saved, setSaved] = useState<string[]>([]);

  const arranged = arrangeDestinations(destinations, { domesticOnly, nonStopOnly, sort });

  if (destinations.length === 0) {
    return (
      <p className="pane__status" role="status">
        Nenhum destino combinou com o que você pediu.
      </p>
    );
  }

  return (
    <div>
      <div className="pane__filters" role="group" aria-label="Filtros">
        <Chip selected={domesticOnly} onClick={() => setDomesticOnly((v) => !v)}>
          Só nacional
        </Chip>
        <Chip selected={nonStopOnly} onClick={() => setNonStopOnly((v) => !v)}>
          Sem escala
        </Chip>
        <Chip
          selected={sort === "price"}
          onClick={() => setSort((s) => (s === "price" ? "match" : "price"))}
        >
          Menor preço
        </Chip>
      </div>

      {arranged.length === 0 ? (
        <p className="pane__status" role="status">
          Nenhum destino combinou com os filtros escolhidos.
        </p>
      ) : (
        <ul className="pane__grid">
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
