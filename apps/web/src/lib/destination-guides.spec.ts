import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  REGION_LABELS,
  destinationLd,
  estimateTripCost,
  groupByRegion,
  guideDescription,
  guideFaq,
  guideTitle,
  joinPt,
  monthList,
  parseDestinationsCsv,
  relatedGuides,
  slugify,
  tagLabel,
  type DestinationGuide
} from "./destination-guides";

// Sobe a árvore até achar o catálogo: o Stryker roda os testes numa cópia em
// .stryker-tmp/sandbox-*, onde o caminho relativo fixo não existe.
function readCatalog(dir: string = __dirname): string {
  const candidate = join(dir, "packages/db/data/destinations.csv");
  if (existsSync(candidate)) return readFileSync(candidate, "utf8");
  const parent = dirname(dir);
  if (parent === dir) throw new Error("destinations.csv não encontrado");
  return readCatalog(parent);
}

const HEADER =
  "city,country,iata,tags,bestMonths,avgFlightCostFromGru,avgLodgingNight,avgDailyLocal,region,visaFreeBr";

const lisboa: DestinationGuide = {
  slug: "lisboa",
  city: "Lisboa",
  country: "Portugal",
  iata: "LIS",
  tags: ["cultura e museus", "gastronomia", "história"],
  bestMonths: [4, 5, 6, 9, 10],
  flightFromGru: 3200,
  lodgingNight: 180,
  dailyLocal: 140,
  region: "europe",
  visaFreeBr: true
};

const orlando: DestinationGuide = {
  ...lisboa,
  slug: "orlando",
  city: "Orlando",
  country: "Estados Unidos",
  iata: "MCO",
  tags: ["familia", "compras", "gastronomia"],
  region: "north-america",
  visaFreeBr: false
};

const maceio: DestinationGuide = {
  ...lisboa,
  slug: "maceio",
  city: "Maceió",
  country: "Brasil",
  iata: "MCZ",
  tags: ["praia"],
  bestMonths: [1],
  region: "brasil",
  visaFreeBr: true
};

describe("slugify", () => {
  it("tira acento, troca espaço por hífen e baixa a caixa", () => {
    expect(slugify("Maceió")).toBe("maceio");
    expect(slugify("Cidade do México")).toBe("cidade-do-mexico");
    expect(slugify("  Foz   do Iguaçu ")).toBe("foz-do-iguacu");
  });

  it("descarta pontuação", () => {
    expect(slugify("St. John's!")).toBe("st-johns");
  });
});

describe("parseDestinationsCsv", () => {
  it("lê uma linha do catálogo", () => {
    const csv = `${HEADER}\nLisboa,Portugal,LIS,cultura e museus;gastronomia,4;5,3200,180,140,europe,true\n`;
    expect(parseDestinationsCsv(csv)).toEqual([
      {
        slug: "lisboa",
        city: "Lisboa",
        country: "Portugal",
        iata: "LIS",
        tags: ["cultura e museus", "gastronomia"],
        bestMonths: [4, 5],
        flightFromGru: 3200,
        lodgingNight: 180,
        dailyLocal: 140,
        region: "europe",
        visaFreeBr: true
      }
    ]);
  });

  it("aceita CRLF, ignora linha vazia e lê visaFreeBr=false", () => {
    const csv = `${HEADER}\r\nOrlando,Estados Unidos,MCO,familia,3,2400,260,200,north-america,false\r\n\r\n`;
    const [row] = parseDestinationsCsv(csv);
    expect(row?.visaFreeBr).toBe(false);
    expect(row?.slug).toBe("orlando");
    expect(parseDestinationsCsv(csv)).toHaveLength(1);
  });

  it("descarta linha com colunas faltando ou número inválido", () => {
    const csv = `${HEADER}\nQuebrada,Brasil,QQQ\nRuim,Brasil,RRR,praia,1,abc,1,1,brasil,true\n`;
    expect(parseDestinationsCsv(csv)).toEqual([]);
  });

  it("descarta mês fora de 1–12", () => {
    const csv = `${HEADER}\nX,Brasil,XXX,praia,0;13;7,1,1,1,brasil,true\n`;
    expect(parseDestinationsCsv(csv)[0]?.bestMonths).toEqual([7]);
  });

  it("descarta linha com coluna sobrando", () => {
    const csv = `${HEADER}\nX,Brasil,XXX,praia,1,1,1,1,brasil,true,extra\n`;
    expect(parseDestinationsCsv(csv)).toEqual([]);
  });

  it("ignora tag vazia, aceita janeiro e dezembro e visaFreeBr com espaço", () => {
    const csv = `${HEADER}\nX,Brasil,XXX,praia;;cultura,1;12,1,1,1,brasil,true \n`;
    const [row] = parseDestinationsCsv(csv);
    expect(row?.tags).toEqual(["praia", "cultura"]);
    expect(row?.bestMonths).toEqual([1, 12]);
    expect(row?.visaFreeBr).toBe(true);
  });

  it("lê o catálogo real inteiro, com slugs únicos", () => {
    const csv = readCatalog();
    const guides = parseDestinationsCsv(csv);
    expect(guides.length).toBeGreaterThanOrEqual(20);
    expect(new Set(guides.map((guide) => guide.slug)).size).toBe(guides.length);
    expect(guides.every((guide) => guide.bestMonths.length > 0)).toBe(true);
  });
});

describe("joinPt", () => {
  it("usa vírgula e 'e' antes do último", () => {
    expect(joinPt([])).toBe("");
    expect(joinPt(["a"])).toBe("a");
    expect(joinPt(["a", "b"])).toBe("a e b");
    expect(joinPt(["a", "b", "c"])).toBe("a, b e c");
  });
});

describe("monthList", () => {
  it("tem o nome dos 12 meses", () => {
    expect(monthList([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe(
      "janeiro, fevereiro, março, abril, maio, junho, julho, agosto, setembro, outubro, novembro e dezembro"
    );
  });

  it("ordena e escreve os meses em português", () => {
    expect(monthList([10, 4, 5])).toBe("abril, maio e outubro");
    expect(monthList([12])).toBe("dezembro");
  });
});

describe("tagLabel", () => {
  it("traduz as tags do catálogo para texto de leitura", () => {
    expect(tagLabel("cultura e museus")).toBe("cultura e museus");
    expect(tagLabel("familia")).toBe("viagem em família");
    expect(tagLabel("relaxar")).toBe("descanso");
    expect(tagLabel("vida noturna")).toBe("vida noturna");
  });
});

describe("estimateTripCost", () => {
  it("soma voo + noites de hospedagem + gasto local por dia", () => {
    expect(estimateTripCost(lisboa, 7)).toBe(3200 + 7 * (180 + 140));
  });
});

describe("guideTitle / guideDescription", () => {
  it("título com roteiro, quando ir e custo, até 60 caracteres", () => {
    expect(guideTitle(lisboa)).toBe("Roteiro em Lisboa: quando ir e quanto custa");
    expect(guideTitle(lisboa).length).toBeLessThanOrEqual(60);
  });

  it("descrição com melhor época e custo estimado, até 160 caracteres", () => {
    const text = guideDescription(lisboa);
    expect(text).toContain("Lisboa");
    expect(text).toContain("abril, maio, junho e mais");
    expect(text).toContain("R$");
    expect(text.length).toBeLessThanOrEqual(160);
  });

  it("com até 3 meses lista todos, sem 'e mais'", () => {
    const text = guideDescription({ ...lisboa, bestMonths: [5, 6] });
    expect(text).toContain("maio e junho");
    expect(text).not.toContain("e mais");
  });

  it("ordena os meses antes de escolher os 3 primeiros", () => {
    const text = guideDescription({ ...lisboa, bestMonths: [10, 9, 6, 5, 4] });
    expect(text).toContain("abril, maio, junho e mais");
  });

  it("exatamente 3 meses: lista os três, sem 'e mais'", () => {
    const text = guideDescription({ ...lisboa, bestMonths: [4, 5, 6] });
    expect(text).toContain("abril, maio e junho");
    expect(text).not.toContain("e mais");
  });

  it("texto completo da descrição", () => {
    expect(guideDescription({ ...lisboa, bestMonths: [5] })).toBe(
      `Lisboa (Portugal): melhor época maio; 7 dias por cerca de ${(3200 + 7 * 320).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} saindo de SP. Monte seu roteiro no Farol.`
    );
  });

  it("todas as descrições do catálogo cabem em 160", () => {
    const csv = readCatalog();
    for (const guide of parseDestinationsCsv(csv)) {
      expect(guideDescription(guide).length).toBeLessThanOrEqual(160);
      expect(guideTitle(guide).length).toBeLessThanOrEqual(60);
    }
  });
});

describe("guideFaq", () => {
  it("responde quando ir e quanto custa", () => {
    const faq = guideFaq(lisboa);
    expect(faq[0]?.question).toBe("Qual a melhor época para ir para Lisboa?");
    expect(faq[0]?.answer).toContain("abril, maio, junho, setembro e outubro");
    expect(faq[1]?.question).toBe("Quanto custa uma viagem de 7 dias para Lisboa?");
    expect(faq[1]?.answer).toContain("R$");
    expect(faq[2]).toEqual({
      question: "O que fazer em Lisboa?",
      answer:
        "Lisboa combina com quem curte cultura e museus, gastronomia e história. O Farol monta o roteiro dia a dia a partir do que você gosta e ajusta por conversa."
    });
  });

  it("fala de visto só fora do Brasil, conforme o catálogo", () => {
    expect(guideFaq(maceio).some((item) => item.question.includes("visto"))).toBe(false);
    const semVisto = guideFaq(lisboa).find((item) => item.question.includes("visto"));
    expect(semVisto?.answer).toMatch(/^Não/);
    const comVisto = guideFaq(orlando).find((item) => item.question.includes("visto"));
    expect(comVisto?.answer).toMatch(/^Sim/);
  });
});

describe("relatedGuides", () => {
  it("ordena pelos gostos em comum, sem repetir o próprio destino", () => {
    const porto = { ...lisboa, slug: "porto", city: "Porto", tags: ["gastronomia", "história"] };
    const related = relatedGuides([lisboa, orlando, maceio, porto], lisboa, 2);
    expect(related.map((guide) => guide.slug)).toEqual(["porto", "orlando"]);
  });

  it("respeita o limite", () => {
    const porto = { ...lisboa, slug: "porto", city: "Porto", tags: ["gastronomia", "história"] };
    expect(relatedGuides([lisboa, orlando, porto], lisboa, 1).map((guide) => guide.slug)).toEqual(["porto"]);
  });

  it("não sugere destino sem nenhum gosto em comum", () => {
    expect(relatedGuides([lisboa, maceio], lisboa, 3)).toEqual([]);
  });
});

describe("groupByRegion", () => {
  it("agrupa na ordem das regiões, com rótulo, e pula região vazia", () => {
    const groups = groupByRegion([orlando, lisboa, maceio]);
    expect(groups.map((group) => group.label)).toEqual(["Brasil", "Europa", "América do Norte e Caribe"]);
    expect(groups[0]?.guides).toEqual([maceio]);
  });

  it("região desconhecida cai em Outros destinos", () => {
    const groups = groupByRegion([{ ...lisboa, region: "antartida" }]);
    expect(groups).toEqual([{ region: "antartida", label: "Outros destinos", guides: [{ ...lisboa, region: "antartida" }] }]);
  });

  it("tem rótulo para todas as regiões do catálogo", () => {
    expect(REGION_LABELS).toEqual({
      brasil: "Brasil",
      "south-america": "América do Sul",
      europe: "Europa",
      "north-america": "América do Norte e Caribe",
      africa: "África"
    });
  });
});

describe("destinationLd", () => {
  it("vira TouristDestination com país e público", () => {
    expect(destinationLd("https://x.com", lisboa)).toEqual({
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      name: "Lisboa",
      description: guideDescription(lisboa),
      url: "https://x.com/destinations/lisboa",
      containedInPlace: { "@type": "Country", name: "Portugal" },
      touristType: ["cultura e museus", "gastronomia", "história"]
    });
  });
});
