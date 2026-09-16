import Link from "next/link";
import { marked } from "marked";
import privacidade from "../../../../../docs/legal/politica-de-privacidade.md";
import "../legal.css";

export const metadata = { title: "Política de Privacidade — Farol" };

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
