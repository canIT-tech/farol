import type { Metadata } from "next";
import { JsonLd } from "../_seo/JsonLd";
import SiteFooter from "../_landing/SiteFooter";
import SiteNav from "../_landing/SiteNav";
import { breadcrumbLd, pageOpenGraph, resolveSiteUrl } from "../../lib/seo";
import { groupByRegion, monthList } from "../../lib/destination-guides";
import { GUIDES } from "./_catalog";
import "./destinations.css";

const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

const TITLE = "Destinos de viagem: quando ir e quanto custa";
const DESCRIPTION =
  "Guias de destinos no Brasil, América do Sul, Europa e Caribe: melhor época, custo estimado de 7 dias saindo de SP e para quem combina. Monte o roteiro no Farol.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/destinations" },
  openGraph: pageOpenGraph({ url: "/destinations", title: TITLE, description: DESCRIPTION })
};

export default function DestinationsPage() {
  const groups = groupByRegion(GUIDES);
  return (
    <div className="landing">
      <JsonLd
        data={[
          breadcrumbLd(siteUrl, [
            { name: "Início", path: "/" },
            { name: "Destinos", path: "/destinations" }
          ])
        ]}
      />
      <SiteNav />
      <main className="wrap guides">
        <nav className="crumbs" aria-label="Trilha">
          <a href="/">Início</a> <span aria-hidden="true">/</span> <span>Destinos</span>
        </nav>
        <h1>Destinos de viagem</h1>
        <p className="lead">
          {GUIDES.length} destinos do catálogo curado do Farol, com a melhor época e o custo médio
          de uma viagem de 7 dias saindo de São Paulo. Não sabe qual escolher? Diga o que você curte
          e o Farol escolhe por você.
        </p>
        {groups.map((group) => (
          <section key={group.region} className="guide-region" aria-labelledby={`r-${group.region}`}>
            <h2 id={`r-${group.region}`}>{group.label}</h2>
            <ul className="guide-grid">
              {group.guides.map((guide) => (
                <li key={guide.slug}>
                  <a href={`/destinations/${guide.slug}`} className="guide-card">
                    <strong>{guide.city}</strong>
                    <span>{guide.country}</span>
                    <small>Melhor época: {monthList(guide.bestMonths.slice(0, 3))}</small>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="guide-cta">
          <a className="cta-button" href="/#lista">
            Quero montar meu roteiro
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
