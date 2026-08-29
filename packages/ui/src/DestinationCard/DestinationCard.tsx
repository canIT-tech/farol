import "./DestinationCard.css";
import { Button } from "../Button/Button";
import { MatchBadge, MatchBar } from "../Match/Match";

export type DestinationStat = { label: string; value: string };

export type DestinationCardProps = {
  city: string;
  country: string;
  matchValue: number;
  rationale: string;
  photoUrl?: string | null;
  stats: DestinationStat[];
  featured?: boolean;
  saved?: boolean;
  onSeeItinerary: () => void;
  onToggleSave: () => void;
};

export function DestinationCard({
  city,
  country,
  matchValue,
  rationale,
  photoUrl,
  stats,
  featured = false,
  saved = false,
  onSeeItinerary,
  onToggleSave
}: DestinationCardProps) {
  const className = ["farol-dcard", featured && "farol-dcard--featured"]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className}>
      <div className="farol-dcard__photo">
        {photoUrl ? (
          <img className="farol-dcard__img" src={photoUrl} alt={`${city}, ${country}`} />
        ) : (
          <div className="farol-dcard__placeholder" role="img" aria-label={`Foto de ${city}`}>
            {city}
          </div>
        )}
        <span className="farol-dcard__badge">
          <MatchBadge value={matchValue} />
        </span>
      </div>

      <div className="farol-dcard__body">
        <h3 className="farol-dcard__city">{city}</h3>
        <p className="farol-dcard__country">{country}</p>
        <MatchBar value={matchValue} />
        <p className="farol-dcard__rationale">{rationale}</p>

        <dl className="farol-dcard__stats">
          {stats.map((s) => (
            <div className="farol-dcard__stat" key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="farol-dcard__foot">
          <Button variant="ghost" size="sm" onClick={onSeeItinerary}>
            Ver roteiro
          </Button>
          <button
            type="button"
            className="farol-dcard__save"
            aria-pressed={saved}
            aria-label={saved ? `Remover ${city} dos salvos` : `Salvar ${city}`}
            onClick={onToggleSave}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill={saved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21s-7-4.6-9.3-9C1 8.5 3 5 6.5 5 9 5 12 7.5 12 7.5S15 5 17.5 5C21 5 23 8.5 21.3 12 19 16.4 12 21 12 21z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
