import type { FlightOffer, ProviderSection } from "@farol/shared";
import { money } from "../../lib/money";

function path(offer: FlightOffer): string {
  return [offer.segments[0]!.fromIata, ...offer.segments.map((s) => s.toIata)].join(" → ");
}

function stopsLabel(stops: number): string {
  if (stops === 0) {
    return "direto";
  }
  return stops === 1 ? "1 escala" : `${stops} escalas`;
}

function duration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

export function OfferList({ section }: { section: ProviderSection<FlightOffer> }) {
  if (section.error !== null) {
    return (
      <p className="rotas__aviso" role="status">
        não consegui buscar voo agora — o provider não respondeu
      </p>
    );
  }
  if (section.offers.length === 0) {
    return (
      <p className="rotas__aviso" role="status">
        nenhum voo para essa data
      </p>
    );
  }
  return (
    <ul className="rotas__ofertas" data-testid="offer-list">
      {section.offers.map((offer) => (
        <li key={offer.id} className="rotas__oferta">
          <strong className="rotas__preco">{money(offer.price, offer.currency)}</strong>
          <span className="rotas__cia">{offer.carrierName ?? offer.carrier}</span>
          {/* O caminho só existe quando o provider entrega os trechos. Sem
              eles, a contagem de escalas é tudo que se sabe — e é o que se
              mostra, em vez de um caminho inventado. */}
          {offer.segments.length > 0 ? (
            <span className="rotas__caminho" data-testid="offer-path">
              {path(offer)}
            </span>
          ) : (
            <span className="rotas__caminho">{stopsLabel(offer.stops)}</span>
          )}
          <span className="rotas__duracao">{duration(offer.durationMinutes)}</span>
          <a className="rotas__link" href={offer.deepLink} target="_blank" rel="noreferrer">
            ver no buscador
          </a>
        </li>
      ))}
    </ul>
  );
}
