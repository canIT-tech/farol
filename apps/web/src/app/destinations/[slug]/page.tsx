import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "../../_seo/JsonLd";
import SiteFooter from "../../_landing/SiteFooter";
import SiteNav from "../../_landing/SiteNav";
import { breadcrumbLd, faqPageLd, pageOpenGraph, resolveSiteUrl } from "../../../lib/seo";
import {
  GUIDE_DAYS,
  destinationLd,
  estimateTripCost,
  guideDescription,
  guideFaq,
  guideTitle,
  joinPt,
  monthList,
  relatedGuides,
  tagLabel
} from "../../../lib/destination-guides";
import { money } from "../../../lib/money";
import { GUIDES, GUIDE_BY_SLUG } from "../_catalog";
import "../destinations.css";

const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

type Props = { params: Promise<{ slug: string }> };

// Todas as páginas saem prontas no build; slug fora do catálogo é 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = GUIDE_BY_SLUG.get((await params).slug);
  if (!guide) return {};
  const path = `/destinations/${guide.slug}`;
  return {
    title: { absolute: `${guideTitle(guide)} | Farol` },
    description: guideDescription(guide),
    alternates: { canonical: path },
    openGraph: pageOpenGraph({
      type: "article",
      url: path,
      title: guideTitle(guide),
      description: guideDescription(guide)
    })
  };
}

const brl = (value: number) => money(value, "brl");

export default async function GuidePage({ params }: Props) {
  const guide = GUIDE_BY_SLUG.get((await params).slug);
  if (!guide) notFound();
  const faq = guideFaq(guide);
  const related = relatedGuides(GUIDES, guide, 4);
  const tags = joinPt(guide.tags.map(tagLabel));
  return (
    <div className="landing">
      <JsonLd
        data={[
          destinationLd(siteUrl, guide),
          breadcrumbLd(siteUrl, [
            { name: "Início", path: "/" },
            { name: "Destinos", path: "/destinations" },
            { name: guide.city, path: `/destinations/${guide.slug}` }
          ]),
          faqPageLd(faq)
        ]}
      />
      <SiteNav />
      <main className="wrap guides">
        <nav className="crumbs" aria-label="Trilha">
          <a href="/">Início</a> <span aria-hidden="true">/</span>{" "}
          <a href="/destinations">Destinos</a> <span aria-hidden="true">/</span>{" "}
          <span>{guide.city}</span>
        </nav>
        <article>
          <p className="eyebrow">{guide.country}</p>
          <h1>Roteiro em {guide.city}: quando ir e quanto custa</h1>
          <p className="lead">
            {guide.city} combina com quem curte {tags}. Abaixo, a melhor época e o custo médio de uma
            viagem de {GUIDE_DAYS} dias saindo de São Paulo, pelo catálogo do Farol.
          </p>

          <dl className="guide-facts">
            <div>
              <dt>Melhor época</dt>
              <dd>{monthList(guide.bestMonths)}</dd>
            </div>
            <div>
              <dt>Voo ida e volta (de SP)</dt>
              <dd>≈ {brl(guide.flightFromGru)}</dd>
            </div>
            <div>
              <dt>Hospedagem</dt>
              <dd>≈ {brl(guide.lodgingNight)} / noite</dd>
            </div>
            <div>
              <dt>Comida e passeios</dt>
              <dd>≈ {brl(guide.dailyLocal)} / dia</dd>
            </div>
            <div className="total">
              <dt>{GUIDE_DAYS} dias, por pessoa</dt>
              <dd>≈ {brl(estimateTripCost(guide, GUIDE_DAYS))}</dd>
            </div>
          </dl>
          <p className="guide-note">
            Valores médios e aproximados. O preço real depende da data, e o Farol mostra a tarifa
            atual antes de você comprar.
          </p>

          <section className="guide-cta-box">
            <h2>Quer o roteiro de {guide.city} dia a dia?</h2>
            <p>
              Diga o que você curte e o ritmo da viagem. O Farol monta o roteiro, mostra voo e hotel
              e ajusta tudo por conversa. A primeira viagem é grátis.
            </p>
            <a className="cta-button" href="/#lista">
              Quero montar meu roteiro
            </a>
          </section>

          <section className="guide-faq">
            <h2>Perguntas sobre {guide.city}</h2>
            <dl className="faq-list">
              {faq.map((item) => (
                <div key={item.question} className="faq-item">
                  <dt>
                    <h3>{item.question}</h3>
                  </dt>
                  <dd>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        </article>

        {related.length > 0 ? (
          <section className="guide-region">
            <h2>Destinos parecidos</h2>
            <ul className="guide-grid">
              {related.map((other) => (
                <li key={other.slug}>
                  <a href={`/destinations/${other.slug}`} className="guide-card">
                    <strong>{other.city}</strong>
                    <span>{other.country}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
