// Guias públicos de destino (/destinations/[slug]) gerados do catálogo curado
// (packages/db/data/destinations.csv). São as páginas de cauda longa do SEO:
// "roteiro em Lisboa", "quando ir para Bariloche", "quanto custa Cancún".
// Só usam dado humano do catálogo — nada de texto inventado por LLM.
import { money } from "./money";
import type { FaqItem } from "./seo";

export type DestinationGuide = {
  slug: string;
  city: string;
  country: string;
  iata: string;
  tags: string[];
  bestMonths: number[];
  flightFromGru: number;
  lodgingNight: number;
  dailyLocal: number;
  region: string;
  visaFreeBr: boolean;
};

export const GUIDE_DAYS = 7;

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

export const REGION_LABELS: Record<string, string> = {
  brasil: "Brasil",
  "south-america": "América do Sul",
  europe: "Europa",
  "north-america": "América do Norte e Caribe",
  africa: "África"
};

const TAG_LABELS: Record<string, string> = {
  familia: "viagem em família",
  relaxar: "descanso"
};

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-");
}

const COLUMNS = 10;

function toGuide(line: string): DestinationGuide | null {
  const cols = line.split(",");
  if (cols.length !== COLUMNS) return null;
  const [city, country, iata, tags, months, flight, lodging, daily, region, visa] = cols as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ];
  const numbers = [flight, lodging, daily].map(Number);
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const [flightFromGru, lodgingNight, dailyLocal] = numbers as [number, number, number];
  return {
    slug: slugify(city),
    city,
    country,
    iata,
    tags: tags.split(";").filter(Boolean),
    bestMonths: months
      .split(";")
      .map(Number)
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    flightFromGru,
    lodgingNight,
    dailyLocal,
    region,
    visaFreeBr: visa.trim() === "true"
  };
}

// O slice(1) tira o cabeçalho. Sem ele o cabeçalho cairia do mesmo jeito na
// validação numérica (mutante equivalente no Stryker), mas explícito é mais claro.
export function parseDestinationsCsv(csv: string): DestinationGuide[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .map(toGuide)
    .filter((guide): guide is DestinationGuide => guide !== null);
}

export function joinPt(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function monthList(months: readonly number[]): string {
  return joinPt([...months].sort((a, b) => a - b).map((m) => MONTHS[m - 1] as string));
}

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag;
}

export function estimateTripCost(guide: DestinationGuide, days: number): number {
  return guide.flightFromGru + days * (guide.lodgingNight + guide.dailyLocal);
}

export function guideTitle(guide: DestinationGuide): string {
  return `Roteiro em ${guide.city}: quando ir e quanto custa`;
}

const brl = (value: number) => money(value, "brl");

export function guideDescription(guide: DestinationGuide): string {
  const months = [...guide.bestMonths].sort((a, b) => a - b);
  const shown = months.slice(0, 3).map((m) => MONTHS[m - 1] as string);
  const when = months.length > 3 ? `${shown.join(", ")} e mais` : joinPt(shown);
  const total = brl(estimateTripCost(guide, GUIDE_DAYS));
  return `${guide.city} (${guide.country}): melhor época ${when}; ${GUIDE_DAYS} dias por cerca de ${total} saindo de SP. Monte seu roteiro no Farol.`;
}

export function guideFaq(guide: DestinationGuide): FaqItem[] {
  const total = brl(estimateTripCost(guide, GUIDE_DAYS));
  const faq: FaqItem[] = [
    {
      question: `Qual a melhor época para ir para ${guide.city}?`,
      answer: `Pelo catálogo do Farol, os melhores meses para ${guide.city} são ${monthList(guide.bestMonths)}. É quando clima e preço costumam andar juntos; o Farol confere a sua data antes de montar o roteiro.`
    },
    {
      question: `Quanto custa uma viagem de ${GUIDE_DAYS} dias para ${guide.city}?`,
      answer: `Na média do catálogo, cerca de ${total} por pessoa saindo de São Paulo: voo de ida e volta perto de ${brl(guide.flightFromGru)}, hospedagem perto de ${brl(guide.lodgingNight)} por noite e ${brl(guide.dailyLocal)} por dia em comida e passeios. É estimativa; o preço real depende da data.`
    },
    {
      question: `O que fazer em ${guide.city}?`,
      answer: `${guide.city} combina com quem curte ${joinPt(guide.tags.map(tagLabel))}. O Farol monta o roteiro dia a dia a partir do que você gosta e ajusta por conversa.`
    }
  ];
  if (guide.country === "Brasil") return faq;
  return [
    ...faq,
    {
      question: `Brasileiro precisa de visto para ${guide.country}?`,
      answer: guide.visaFreeBr
        ? `Não, para turismo, segundo o catálogo do Farol. Confirme as regras de entrada no consulado antes de comprar a passagem.`
        : `Sim, para turismo, segundo o catálogo do Farol. Confirme prazos e documentos no consulado antes de comprar a passagem.`
    }
  ];
}

export function relatedGuides(
  all: readonly DestinationGuide[],
  guide: DestinationGuide,
  limit: number
): DestinationGuide[] {
  const mine = new Set(guide.tags);
  return all
    .filter((other) => other.slug !== guide.slug)
    .map((other) => ({ other, shared: other.tags.filter((tag) => mine.has(tag)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(({ other }) => other);
}

export type RegionGroup = { region: string; label: string; guides: DestinationGuide[] };

export function groupByRegion(guides: readonly DestinationGuide[]): RegionGroup[] {
  const byRegion = guides.reduce((acc, guide) => {
    acc.set(guide.region, [...(acc.get(guide.region) ?? []), guide]);
    return acc;
  }, new Map<string, DestinationGuide[]>());
  const known = Object.keys(REGION_LABELS);
  const order = [...known, ...[...byRegion.keys()].filter((region) => !(region in REGION_LABELS))];
  return order
    .filter((region) => byRegion.has(region))
    .map((region) => ({
      region,
      label: REGION_LABELS[region] ?? "Outros destinos",
      guides: byRegion.get(region) as DestinationGuide[]
    }));
}

export function destinationLd(base: string, guide: DestinationGuide): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: guide.city,
    description: guideDescription(guide),
    url: `${base}/destinations/${guide.slug}`,
    containedInPlace: { "@type": "Country", name: guide.country },
    touristType: guide.tags
  };
}
