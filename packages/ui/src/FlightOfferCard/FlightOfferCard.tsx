import "./FlightOfferCard.css";
import { Button } from "../Button/Button";

// "2026-11-04T18:05:00-03:00" → "18:05". O provider já devolve o horário no
// fuso do aeroporto, então cortar a string é o certo: converter para o fuso do
// navegador mostraria um horário que não é o do embarque.
export function localTime(iso: string): string {
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match === null ? "" : match[1]!;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "2026-11-04T18:05:00-03:00" → "4 de nov". Mesma lógica do localTime: a data
// é a do aeroporto, cortada da string. Ela entra no cartão porque a oferta vem
// do cache do parceiro e pode cair fora das datas da viagem.
export function localDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m} min`;
  }
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}`;
}

export function stopsLabel(stops: number): string {
  if (stops === 0) {
    return "Direto";
  }
  return stops === 1 ? "1 escala" : `${stops} escalas`;
}

/** "GRU São Paulo → CTG Cartagena". Sem nome no catálogo, fica só o código. */
export function routeLabel(
  originIata: string,
  originName: string | null,
  destinationIata: string,
  destinationName: string | null
): string {
  const side = (iata: string, name: string | null) => (name === null ? iata : `${iata} ${name}`);
  return `${side(originIata, originName)} → ${side(destinationIata, destinationName)}`;
}

export type FlightOfferCardProps = {
  carrier: string;
  carrierName?: string | null;
  departAt: string;
  arriveAt: string;
  originIata: string;
  originName?: string | null;
  destinationIata: string;
  destinationName?: string | null;
  durationMinutes: number;
  stops: number;
  price: string;
  /** "ida e volta / pessoa" ou "só ida / pessoa". */
  priceNote: string;
  deepLink: string;
  partnerName: string;
  best?: boolean;
  busy?: boolean;
  onSelect: () => void;
};

export function FlightOfferCard({
  carrier,
  carrierName = null,
  departAt,
  arriveAt,
  originIata,
  originName = null,
  destinationIata,
  destinationName = null,
  durationMinutes,
  stops,
  price,
  priceNote,
  deepLink,
  partnerName,
  best = false,
  busy = false,
  onSelect
}: FlightOfferCardProps) {
  const route = routeLabel(originIata, originName, destinationIata, destinationName);
  const direct = stops === 0;

  return (
    <article
      className={["farol-flight", best && "farol-flight--best"].filter(Boolean).join(" ")}
      aria-label={`${carrierName ?? carrier}, ${route}, ${price}`}
    >
      <div className="farol-flight__airline" title={carrierName ?? undefined}>
        {carrier}
      </div>

      <div>
        <p className="farol-flight__times">{`${localTime(departAt)} → ${localTime(arriveAt)}`}</p>
        <p className="farol-flight__sub">
          {[carrierName, localDate(departAt), route].filter((part) => part !== null).join(" · ")}
        </p>
      </div>

      <p className="farol-flight__duration">
        {durationMinutes > 0 ? <b>{durationLabel(durationMinutes)}</b> : null}
        <span className={direct ? "farol-flight__direct" : undefined}>{stopsLabel(stops)}</span>
      </p>

      <div className="farol-flight__price">
        <p className="farol-flight__amount">{price}</p>
        <p className="farol-flight__per">{priceNote}</p>
        <span className="farol-flight__action">
          <Button size="sm" disabled={busy} onClick={onSelect}>
            Selecionar
          </Button>
        </span>
        <p className="farol-flight__partner">
          <a href={deepLink} target="_blank" rel="noreferrer">
            {`abre no ${partnerName} ↗`}
          </a>
        </p>
      </div>
    </article>
  );
}
