import type { Metadata } from "next";
import Link from "next/link";
import { marked } from "marked";
import termos from "../../../../../docs/legal/termos-de-uso.md";
import { pageOpenGraph } from "../../lib/seo";
import "../legal.css";

const TITLE = "Termos de Uso";
const DESCRIPTION =
  "Termos de Uso do Farol Viagens: como funciona o planejador de viagem, pagamento por viagem, primeira viagem grátis, arrependimento e reembolso.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: pageOpenGraph({ url: "/terms", title: TITLE, description: DESCRIPTION })
};

// O markdown é nosso (docs/legal, no repo), não entrada de usuário: renderizar
// o HTML dele é seguro. A Stripe exige esta página pública para ativar a conta
// e para o aceite no checkout.
export default function TermosPage() {
  return (
    <main className="legal">
      <Link className="legal__voltar" href="/">
        ← Farol
      </Link>
      <article dangerouslySetInnerHTML={{ __html: marked.parse(termos) as string }} />
    </main>
  );
}
