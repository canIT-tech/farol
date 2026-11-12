import { GUIDES } from "./destinations/_catalog";
import { JsonLd } from "./_seo/JsonLd";
import { HOME_FAQ, PLANS, faqPageLd, resolveSiteUrl, softwareApplicationLd } from "../lib/seo";
import ChatDemo from "./_landing/ChatDemo";
import Modes from "./_landing/Modes";
import Screens from "./_landing/Screens";
import SiteFooter from "./_landing/SiteFooter";
import SiteNav from "./_landing/SiteNav";
import TasteDemo from "./_landing/TasteDemo";
import WaitlistForm from "./_landing/WaitlistForm";

// Server Component: o HTML chega pronto (conteúdo, FAQ, links dos guias) e só
// as demos e o formulário hidratam. Antes a página inteira era "use client".
const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

const FEATURED_SLUGS = ["lisboa", "buenos-aires", "cartagena", "bariloche", "fernando-de-noronha", "cidade-do-mexico", "gramado", "cancun"];
const FEATURED = GUIDES.filter((guide) => FEATURED_SLUGS.includes(guide.slug));

export default function HomePage() {
  return (
    <div className="landing">
      <JsonLd data={[softwareApplicationLd(siteUrl), faqPageLd(HOME_FAQ)]} />
      <SiteNav />

      <main>
        <section className="hero wrap" id="lista">
          <p className="eyebrow">Lista de primeiros usuários</p>
          <h1>
            <span className="hero-kicker">Planejador de viagem com IA</span>{" "}
            Você não precisa saber para onde ir.
          </h1>
          <p className="deck">
            O Farol parte do seu gosto, acha o destino, monta o dia a dia e ajusta tudo por
            conversa. Ainda estamos construindo — entre na lista e teste antes de todo mundo.
          </p>
          <WaitlistForm source="landing-hero" />
          <p className="trust">Sem spam. Um único e-mail quando abrir o acesso.</p>
        </section>

        <section className="band-dark" id="experimente">
          <div className="wrap reveal">
            <p className="eyebrow">Experimente agora</p>
            <h2 className="h2">Escolha o que você curte. O Farol devolve um destino com o porquê.</h2>
            <p className="lead">
              É o mesmo motor do produto, com dados de exemplo. Toque nos gostos e veja o
              resultado mudar.
            </p>
            <TasteDemo />
          </div>
        </section>

        <section className="wrap reveal" id="experiencia">
          <p className="eyebrow">A experiência, tela por tela</p>
          <h2 className="h2">Percorra o fluxo como quem já está usando.</h2>
          <p className="lead">
            Escolha o que te move e o ritmo, siga para os destinos, abra um roteiro. É o
            caminho real do app, aqui na página.
          </p>
          <Screens />
        </section>

        <section className="wrap reveal">
          <p className="eyebrow">Ajuste por conversa</p>
          <h2 className="h2">Mudou de ideia? O plano se refaz — você não recomeça.</h2>
          <p className="lead">
            Clique num pedido e acompanhe o roteiro à direita mudar na hora.
          </p>
          <ChatDemo />
        </section>

        <section className="wrap reveal">
          <p className="eyebrow">Dois jeitos de usar</p>
          <h2 className="h2">Do controle total ao “decide por mim”.</h2>
          <Modes />
        </section>

        <section className="wrap reveal" id="precos">
          <p className="eyebrow">Preços (planejado)</p>
          <h2 className="h2">Sem assinatura. Você paga a viagem que montar.</h2>
          <div className="pay">
            {PLANS.map((plan) => (
              <div key={plan.name} className={plan.featured ? "feature" : undefined}>
                <h3>{plan.name}</h3>
                <p className="price">R$ {plan.price}</p>
                <small>{plan.description}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="honest">
          <div className="wrap reveal">
            <p className="eyebrow">Honesto sobre o que ainda não faz</p>
            <h2 className="h2">O Farol assume o trabalho — não finge saber o que não sabe.</h2>
            <ul>
              <li>Não reserva voo nem hotel por você — leva até a página de compra do parceiro.</li>
              <li>Comparação com milhas vem depois do lançamento inicial.</li>
              <li>O roteiro é um ponto de partida forte, não a palavra final.</li>
            </ul>
          </div>
        </section>

        <section className="wrap reveal" id="destinos">
          <p className="eyebrow">Para onde ir</p>
          <h2 className="h2">Destinos com roteiro, época certa e custo estimado.</h2>
          <p className="lead">
            Guias do catálogo curado do Farol: quando ir, quanto custa uma viagem de 7 dias saindo
            de São Paulo e para quem cada lugar combina.
          </p>
          <ul className="guide-grid">
            {FEATURED.map((guide) => (
              <li key={guide.slug}>
                <a href={`/destinations/${guide.slug}`} className="guide-card">
                  <strong>{guide.city}</strong>
                  <span>{guide.country}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="guide-more">
            <a href="/destinations">Ver todos os {GUIDES.length} destinos →</a>
          </p>
        </section>

        <section className="wrap reveal faq" id="perguntas">
          <p className="eyebrow">Dúvidas</p>
          <h2 className="h2">Perguntas frequentes</h2>
          <dl className="faq-list">
            {HOME_FAQ.map((item) => (
              <div key={item.question} className="faq-item">
                <dt>
                  <h3>{item.question}</h3>
                </dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="final wrap reveal">
          <p className="eyebrow">Lista de primeiros usuários</p>
          <h2>Entre agora e teste antes de todo mundo.</h2>
          <WaitlistForm source="landing-footer" />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
