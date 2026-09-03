import "./HotelOfferCard.css";
import { Button } from "../Button/Button";

/** "Chiado · 4 paradas a pé" — área e, quando houver, a distância do roteiro. */
export function areaLabel(region: string | null, walkingNote: string | null): string | null {
  const parts = [region, walkingNote].filter((p): p is string => p !== null && p !== "");
  return parts.length === 0 ? null : parts.join(" · ");
}

/** Nota dos hóspedes com a estrela. Sem nota, some — não vira "0 ★". */
export function ratingLabel(rating: number | null): string | null {
  return rating === null ? null : `${rating.toFixed(1)} ★`;
}

export type HotelOfferCardProps = {
  name: string;
  region?: string | null;
  /** Distância até o roteiro, quando já foi calculada. */
  walkingNote?: string | null;
  photoUrl?: string | null;
  rating?: number | null;
  pricePerNight: string;
  deepLink: string;
  partnerLabel?: string;
  busy?: boolean;
  onSelect: () => void;
};

export function HotelOfferCard({
  name,
  region = null,
  walkingNote = null,
  photoUrl = null,
  rating = null,
  pricePerNight,
  deepLink,
  partnerLabel = "Ver no parceiro",
  busy = false,
  onSelect
}: HotelOfferCardProps) {
  const area = areaLabel(region, walkingNote);
  const nota = ratingLabel(rating);

  return (
    <article className="farol-hcard" aria-label={`${name}, ${pricePerNight} por noite`}>
      {photoUrl === null ? (
        <div className="farol-hcard__photo farol-hcard__photo--empty" role="presentation" />
      ) : (
        <img className="farol-hcard__photo" src={photoUrl} alt={`Foto do ${name}`} />
      )}

      <div className="farol-hcard__body">
        <h3 className="farol-hcard__name">{name}</h3>
        {area === null ? null : <p className="farol-hcard__area">{area}</p>}

        <div className="farol-hcard__row">
          <span className="farol-hcard__rating">{nota ?? ""}</span>
          <span className="farol-hcard__price">
            {pricePerNight} <span>/noite</span>
          </span>
        </div>

        <div className="farol-hcard__actions">
          <Button size="sm" disabled={busy} onClick={onSelect}>
            Escolher
          </Button>
          <a
            className="farol-hcard__partner"
            href={deepLink}
            target="_blank"
            rel="noreferrer"
          >
            {partnerLabel}
          </a>
        </div>
      </div>
    </article>
  );
}
