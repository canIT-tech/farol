import Link from "next/link";
import { marked } from "marked";
import termos from "../../../../../docs/legal/termos-de-uso.md";
import "../legal.css";

export const metadata = { title: "Termos de Uso — Farol" };

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
