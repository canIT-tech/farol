import { describe, it, expect } from "vitest";
import {
  DEFAULT_SITE_URL,
  HOME_FAQ,
  PLANS,
  AI_TRAINING_BOTS,
  CRAWL_BLOCKED_PATHS,
  NOINDEX_PATHS,
  SITE,
  absoluteUrl,
  pageOpenGraph,
  breadcrumbLd,
  faqPageLd,
  organizationLd,
  resolveSiteUrl,
  robotsRules,
  serializeJsonLd,
  softwareApplicationLd,
  splitEmailForDisplay,
  websiteLd
} from "./seo";

const BASE = "https://exemplo.com";

describe("resolveSiteUrl", () => {
  it("usa o default quando a env não existe ou está vazia", () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("   ")).toBe(DEFAULT_SITE_URL);
  });

  it("tira a barra final e espaços", () => {
    expect(resolveSiteUrl(" https://farolviagens.com/ ")).toBe("https://farolviagens.com");
    expect(resolveSiteUrl("https://farolviagens.com///")).toBe("https://farolviagens.com");
  });

  it("mantém um caminho base sem barra final", () => {
    expect(resolveSiteUrl("https://x.com/app/")).toBe("https://x.com/app");
  });

  it("recusa protocolo que não seja http(s) e texto que não é URL", () => {
    expect(resolveSiteUrl("ftp://x.com")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("não é url")).toBe(DEFAULT_SITE_URL);
  });

  it("aceita http (ambiente local)", () => {
    expect(resolveSiteUrl("http://localhost:3100")).toBe("http://localhost:3100");
  });

  it("o default é https e sem barra final", () => {
    expect(DEFAULT_SITE_URL).toBe("https://farol.butland.sbs");
  });
});

describe("absoluteUrl", () => {
  it("junta base e caminho com uma barra só", () => {
    expect(absoluteUrl(BASE, "/destinations")).toBe("https://exemplo.com/destinations");
    expect(absoluteUrl(BASE, "destinations")).toBe("https://exemplo.com/destinations");
  });

  it("só tira barras do começo, todas elas", () => {
    expect(absoluteUrl(BASE, "a/b")).toBe("https://exemplo.com/a/b");
    expect(absoluteUrl(BASE, "//a")).toBe("https://exemplo.com/a");
  });

  it("raiz vira a base com barra", () => {
    expect(absoluteUrl(BASE, "/")).toBe("https://exemplo.com/");
    expect(absoluteUrl(BASE, "")).toBe("https://exemplo.com/");
  });
});

describe("SITE", () => {
  it("título e descrição carregam a palavra-chave principal", () => {
    expect(SITE.title.toLowerCase()).toContain("planejador de viagem");
    expect(SITE.description.toLowerCase()).toContain("roteiro");
  });

  it("título cabe no SERP (≤ 60) e a descrição entre 120 e 160", () => {
    expect(SITE.title.length).toBeLessThanOrEqual(60);
    expect(SITE.description.length).toBeGreaterThanOrEqual(120);
    expect(SITE.description.length).toBeLessThanOrEqual(160);
  });

  it("marca pública e locale do Brasil", () => {
    expect(SITE.name).toBe("Farol Viagens");
    expect(SITE.locale).toBe("pt_BR");
    expect(SITE.keywords).toContain("planejador de viagem");
  });
});

describe("NOINDEX_PATHS / CRAWL_BLOCKED_PATHS", () => {
  it("área logada leva noindex", () => {
    for (const path of ["/login", "/onboarding", "/trips", "/auto", "/credits", "/payment", "/rotas", "/status"]) {
      expect(NOINDEX_PATHS).toContain(path);
    }
  });

  it("só a api sai do rastreamento", () => {
    expect(CRAWL_BLOCKED_PATHS).toEqual(["/api/"]);
  });

  it("nunca fecha as páginas públicas", () => {
    for (const path of ["/", "/destinations", "/terms", "/privacy"]) {
      expect(NOINDEX_PATHS).not.toContain(path);
      expect(CRAWL_BLOCKED_PATHS).not.toContain(path);
    }
  });
});

describe("PLANS", () => {
  it("textos e destaque iguais aos da landing", () => {
    expect(PLANS).toEqual([
      {
        name: "Grátis",
        price: 0,
        description: "Sua primeira viagem, completa: destino, roteiro e ajustes por conversa.",
        featured: false
      },
      { name: "Viagem", price: 39, description: "Produto completo com chat de ajuste. Pagamento único.", featured: true },
      { name: "Pacote 3 viagens", price: 89, description: "Para quem já sabe que vai planejar mais de uma.", featured: false }
    ]);
  });

  it("são os preços da landing, em reais", () => {
    expect(PLANS.map((plan) => [plan.name, plan.price])).toEqual([
      ["Grátis", 0],
      ["Viagem", 39],
      ["Pacote 3 viagens", 89]
    ]);
  });
});

describe("organizationLd", () => {
  it("descreve a organização com logo absoluto e e-mail de contato", () => {
    const ld = organizationLd(BASE);
    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://exemplo.com/#organization",
      name: "Farol Viagens",
      alternateName: "Farol",
      url: "https://exemplo.com/",
      logo: "https://exemplo.com/apple-icon",
      email: "contato@ignaulin.com",
      legalName: "IGNAULIN SOLUCOES TECNOLOGICAS LTDA",
      taxID: "49.181.911/0001-51",
      areaServed: { "@type": "Country", name: "Brasil" }
    });
  });
});

describe("websiteLd", () => {
  it("liga o site à organização, em pt-BR", () => {
    expect(websiteLd(BASE)).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://exemplo.com/#website",
      name: "Farol Viagens",
      alternateName: "Farol",
      url: "https://exemplo.com/",
      inLanguage: "pt-BR",
      publisher: { "@id": "https://exemplo.com/#organization" }
    });
  });
});

describe("softwareApplicationLd", () => {
  it("vira um app de viagem com uma oferta por plano", () => {
    const ld = softwareApplicationLd(BASE);
    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Farol Viagens",
      url: "https://exemplo.com/",
      applicationCategory: "TravelApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
      publisher: { "@id": "https://exemplo.com/#organization" }
    });
    expect(ld.offers).toEqual([
      { "@type": "Offer", name: "Grátis", price: "0", priceCurrency: "BRL", description: PLANS[0]?.description },
      { "@type": "Offer", name: "Viagem", price: "39", priceCurrency: "BRL", description: PLANS[1]?.description },
      { "@type": "Offer", name: "Pacote 3 viagens", price: "89", priceCurrency: "BRL", description: PLANS[2]?.description }
    ]);
    expect(ld.featureList).toEqual([
      "Descoberta de destino pelo seu gosto",
      "Roteiro de viagem dia a dia",
      "Ajuste do roteiro por conversa",
      "Voo e hotel com preço aproximado",
      "Modo autônomo: um plano fechado a partir de datas, origem e orçamento"
    ]);
  });
});

describe("faqPageLd", () => {
  it("mapeia pergunta e resposta para Question/Answer", () => {
    expect(faqPageLd([{ question: "P?", answer: "R." }])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "P?", acceptedAnswer: { "@type": "Answer", text: "R." } }]
    });
  });

  it("o FAQ da home responde o que é um planejador de viagem", () => {
    expect(HOME_FAQ.length).toBeGreaterThanOrEqual(5);
    expect(HOME_FAQ.some((item) => item.question.toLowerCase().includes("planejador de viagem"))).toBe(true);
    expect(HOME_FAQ.every((item) => item.question.endsWith("?") && item.answer.length > 40)).toBe(true);
  });
});

describe("breadcrumbLd", () => {
  it("numera a trilha a partir de 1, com URLs absolutas", () => {
    expect(
      breadcrumbLd(BASE, [
        { name: "Início", path: "/" },
        { name: "Destinos", path: "/destinations" }
      ])
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://exemplo.com/" },
        { "@type": "ListItem", position: 2, name: "Destinos", item: "https://exemplo.com/destinations" }
      ]
    });
  });
});

describe("serializeJsonLd", () => {
  it("escapa < para o conteúdo não fechar o <script>", () => {
    const out = serializeJsonLd({ text: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ text: "</script><script>alert(1)</script>" });
  });
});

describe("splitEmailForDisplay", () => {
  // O Cloudflare (Email Obfuscation) reescreve e-mail inteiro no HTML e quebra a
  // hidratação do React (#418). Partido em pedaços, ele não reconhece.
  it("separa usuário e domínio do texto ao redor", () => {
    expect(splitEmailForDisplay("A · CNPJ 1 · contato@ignaulin.com")).toEqual({
      before: "A · CNPJ 1 · ",
      user: "contato",
      domain: "ignaulin.com",
      after: ""
    });
  });

  it("mantém o texto depois do e-mail", () => {
    expect(splitEmailForDisplay("x a@b.co y")).toEqual({ before: "x ", user: "a", domain: "b.co", after: " y" });
  });

  it("sem e-mail devolve tudo em before", () => {
    expect(splitEmailForDisplay("sem email")).toEqual({ before: "sem email", user: "", domain: "", after: "" });
  });
});

describe("pageOpenGraph", () => {
  // openGraph de uma página substitui o da raiz inteiro (o Next não mescla):
  // sem isto, os guias saíam sem imagem, site_name e locale.
  it("repete imagem, site e locale da raiz junto com o que a página define", () => {
    expect(pageOpenGraph({ url: "/destinations", title: "T", description: "D" })).toEqual({
      siteName: "Farol Viagens",
      locale: "pt_BR",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.title }],
      url: "/destinations",
      title: "T",
      description: "D"
    });
  });

  it("aceita outro tipo (artigo)", () => {
    expect(pageOpenGraph({ url: "/x", title: "T", description: "D", type: "article" }).type).toBe("article");
  });
});

describe("robotsRules", () => {
  // O Cloudflare "Block AI training crawlers" barrava o próprio Googlebot (403
  // no Search Console, 2026-11-04). O treino de IA sai da borda e vira regra do
  // robots.txt, que é como o Google separa busca (Googlebot) de treino (Google-Extended).
  it("libera tudo para os buscadores e fecha só a api", () => {
    expect(robotsRules()[0]).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/"] });
  });

  it("bloqueia os robôs de treino de IA, nunca os de busca", () => {
    const training = robotsRules()[1];
    expect(training).toEqual({ userAgent: [...AI_TRAINING_BOTS], disallow: "/" });
    expect(AI_TRAINING_BOTS).toEqual([
      "GPTBot",
      "ClaudeBot",
      "anthropic-ai",
      "CCBot",
      "Google-Extended",
      "Applebot-Extended",
      "Bytespider",
      "meta-externalagent",
      "cohere-ai",
      "Diffbot",
      "Amazonbot",
      "omgili"
    ]);
    for (const searchBot of ["Googlebot", "Bingbot", "Applebot", "OAI-SearchBot", "PerplexityBot", "ChatGPT-User"]) {
      expect(AI_TRAINING_BOTS).not.toContain(searchBot);
    }
  });

  it("são só essas duas regras", () => {
    expect(robotsRules()).toHaveLength(2);
  });
});
