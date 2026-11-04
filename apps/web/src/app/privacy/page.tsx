import type { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";
import privacidade from "../../../../../docs/legal/politica-de-privacidade.md";
import { pageOpenGraph } from "../../lib/seo";
import "../legal.css";

const TITLE = "Política de Privacidade";
const DESCRIPTION =
  "Política de Privacidade do Farol Viagens (LGPD): quais dados o planejador de viagem coleta, para quê, com quem compartilha e como pedir a exclusão.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: pageOpenGraph({ url: "/privacy", title: TITLE, description: DESCRIPTION })
};

// Mesmo arranjo de /terms: o texto vem de docs/legal e é nosso.
export default function PrivacidadePage() {
  return (
    <main className="legal">
      <Link className="legal__voltar" href="/">
        ← Farol
      </Link>
      <article dangerouslySetInnerHTML={{ __html: marked.parse(privacidade) as string }} />
    </main>
  );
}
