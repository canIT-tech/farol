// SEO: fonte única dos textos de busca, dos planos e dos dados estruturados
// (schema.org) que vão nas páginas públicas. Funções puras: as páginas só
// passam a URL base. Relatório e motivo de cada escolha: docs/seo/.

// Produção atual. Quando `farolviagens.com` for registrado, basta
// NEXT_PUBLIC_SITE_URL apontar para ele (e 301 deste host para lá).
export const DEFAULT_SITE_URL = "https://farol.butland.sbs";

export function resolveSiteUrl(raw: string | undefined): string {
  try {
    // new URL já tira espaço das pontas e recusa vazio/undefined ("undefined").
    const url = new URL(String(raw));
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_SITE_URL;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(base: string, path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${base}/${clean}`;
}

export const SITE = {
  name: "Farol Viagens",
  shortName: "Farol",
  // ≤ 60 caracteres: o Google corta o resto no resultado.
  title: "Farol: planejador de viagem com IA e roteiro pronto",
  // 120–160 caracteres.
  description:
    "Planejador de viagem com IA: diga o que você curte e o Farol acha o destino, monta o roteiro dia a dia e ajusta tudo por conversa. 1ª viagem grátis.",
  locale: "pt_BR",
  language: "pt-BR",
  keywords: [
    "planejador de viagem",
    "planejador de viagem com IA",
    "roteiro de viagem",
    "montar roteiro de viagem",
    "para onde viajar",
    "viagens",
    "assessor de viagem",
    "inteligência artificial para viagem",
    "roteiro personalizado",
    "destino de viagem"
  ]
} as const;

// Área logada e fluxo de pagamento: sem conteúdo público, a sessão vive no
// browser — indexar só gera tela de login duplicada. Ficam rastreáveis e levam
// `noindex` (bloquear no robots.txt impediria o Google de ler o noindex e a URL
// podia entrar no índice mesmo assim, só pelo link).
export const NOINDEX_PATHS = [
  "/login",
  "/onboarding",
  "/trips",
  "/auto",
  "/credits",
  "/payment",
  "/rotas",
  "/status"
] as const;

// Só a api sai do rastreamento: é JSON, não página.
export const CRAWL_BLOCKED_PATHS = ["/api/"] as const;

export type Plan = { name: string; price: number; description: string; featured: boolean };

export const PLANS: readonly Plan[] = [
  {
    name: "Grátis",
    price: 0,
    description: "Sua primeira viagem, completa: destino, roteiro e ajustes por conversa.",
    featured: false
  },
  {
    name: "Viagem",
    price: 39,
    description: "Produto completo com chat de ajuste. Pagamento único.",
    featured: true
  },
  {
    name: "Pacote 3 viagens",
    price: 89,
    description: "Para quem já sabe que vai planejar mais de uma.",
    featured: false
  }
];

export type FaqItem = { question: string; answer: string };

// Texto visível na home (seção "Perguntas frequentes") e no FAQPage. As duas
// saem daqui para o JSON-LD nunca divergir do que a pessoa lê.
export const HOME_FAQ: readonly FaqItem[] = [
  {
    question: "O que é um planejador de viagem com IA?",
    answer:
      "É um assistente que monta a viagem por você. No Farol, você diz o que curte, quando pode ir e quanto quer gastar. Ele sugere o destino com o porquê, monta o roteiro dia a dia e mostra voo e hotel."
  },
  {
    question: "Não sei para onde viajar. O Farol escolhe o destino?",
    answer:
      "Sim. Ele cruza seus gostos (praia, gastronomia, cultura, natureza…) com clima, custo e época de cada lugar. Devolve uma lista curta de destinos, cada um com o motivo. No modo autônomo, devolve um plano só, já fechado."
  },
  {
    question: "Quanto custa usar o Farol?",
    answer:
      "A primeira viagem é grátis e completa. Depois, R$ 39 por viagem ou R$ 89 no pacote de 3. Sem assinatura, e ajustes numa viagem já liberada não cobram de novo."
  },
  {
    question: "O Farol reserva voo e hotel?",
    answer:
      "Não. Ele mostra opções com preço aproximado e leva você até a página de compra do parceiro. A reserva é feita lá, direto com a companhia ou o hotel."
  },
  {
    question: "Dá para mudar o roteiro depois de pronto?",
    answer:
      "Dá, por conversa. Peça \"menos museu, mais praia\" ou \"troca o jantar por um lugar mais tranquilo\", e o roteiro se refaz sem você começar do zero."
  },
  {
    question: "Os preços de voo são exatos?",
    answer:
      "São aproximados. O Farol busca tarifas recentes, mas o preço final é o da página de compra, e o app avisa quando o valor pode ter mudado."
  }
];

export type PageOpenGraph = {
  url: string;
  title: string;
  description: string;
  type?: "website" | "article";
};

// O `openGraph` de uma página substitui o da raiz inteiro (o Next não mescla),
// então cada página repete imagem, site e locale por aqui.
export function pageOpenGraph(page: PageOpenGraph) {
  return {
    siteName: SITE.name,
    locale: SITE.locale,
    type: page.type ?? "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.title }],
    url: page.url,
    title: page.title,
    description: page.description
  };
}

type Ld = Record<string, unknown>;

const CONTEXT = "https://schema.org";
const ORG_EMAIL = "contato@ignaulin.com";

const rootUrl = (base: string) => `${base}/`;
const orgId = (base: string) => `${rootUrl(base)}#organization`;

export function organizationLd(base: string): Ld {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": orgId(base),
    name: SITE.name,
    alternateName: SITE.shortName,
    url: rootUrl(base),
    logo: absoluteUrl(base, "/apple-icon"),
    email: ORG_EMAIL,
    legalName: "IGNAULIN SOLUCOES TECNOLOGICAS LTDA",
    taxID: "49.181.911/0001-51",
    areaServed: { "@type": "Country", name: "Brasil" }
  };
}

export function websiteLd(base: string): Ld {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": `${rootUrl(base)}#website`,
    name: SITE.name,
    alternateName: SITE.shortName,
    url: rootUrl(base),
    inLanguage: SITE.language,
    publisher: { "@id": orgId(base) }
  };
}

export function softwareApplicationLd(base: string): Ld & { offers: Ld[]; featureList: string[] } {
  return {
    "@context": CONTEXT,
    "@type": "WebApplication",
    name: SITE.name,
    url: rootUrl(base),
    description: SITE.description,
    applicationCategory: "TravelApplication",
    operatingSystem: "Web",
    inLanguage: SITE.language,
    publisher: { "@id": orgId(base) },
    featureList: [
      "Descoberta de destino pelo seu gosto",
      "Roteiro de viagem dia a dia",
      "Ajuste do roteiro por conversa",
      "Voo e hotel com preço aproximado",
      "Modo autônomo: um plano fechado a partir de datas, origem e orçamento"
    ],
    offers: PLANS.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: String(plan.price),
      priceCurrency: "BRL",
      description: plan.description
    }))
  };
}

export function faqPageLd(items: readonly FaqItem[]): Ld {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbLd(base: string, crumbs: readonly Crumb[]): Ld {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(base, crumb.path)
    }))
  };
}

// JSON dentro de <script>: "<" escapado impede que um texto feche a tag.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type EmailParts = { before: string; user: string; domain: string; after: string };

const EMAIL_IN_TEXT = /([^\s@]+)@([^\s@]+\.[^\s@]+)/;

// O Email Obfuscation do Cloudflare troca o e-mail do HTML por um link
// /cdn-cgi/l/email-protection; o React vê texto diferente e re-renderiza a
// página inteira (erro #418). Em pedaços separados, o Cloudflare não acha.
export function splitEmailForDisplay(text: string): EmailParts {
  const match = EMAIL_IN_TEXT.exec(text);
  if (!match) return { before: text, user: "", domain: "", after: "" };
  return {
    before: text.slice(0, match.index),
    user: match[1] as string,
    domain: match[2] as string,
    after: text.slice(match.index + match[0].length)
  };
}
