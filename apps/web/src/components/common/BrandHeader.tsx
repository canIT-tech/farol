import Link from "next/link";
import type { ReactNode } from "react";

function Mark() {
  return (
    <>
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 43h14" />
          <path d="M19.5 43 L21.5 25 h5 l2 18" />
          <path d="M20.5 25 h7" />
          <rect x="20.5" y="18" width="7" height="7" rx="1.2" />
          <path d="M22 18 h4 l-1 -3 h-2 z" />
        </svg>
      Farol
    </>
  );
}

/** A marca sozinha: farol + palavra. Com `href`, vira o caminho de volta —
 *  numa área logada, clicar na marca é o gesto esperado para sair da tela. */
export function BrandMark({
  className = "screen__logo",
  href
}: {
  className?: string;
  href?: string;
}) {
  if (href === undefined) {
    return (
      <div className={className}>
        <Mark />
      </div>
    );
  }
  return (
    <Link className={className} href={href} aria-label="Farol — voltar para minhas viagens">
      <Mark />
    </Link>
  );
}

/** Cabeçalho de marca das telas de coluna única, como no hi-fi: farol à
 *  esquerda, e à direita o que a tela quiser dizer (modo, ações). */
export function BrandHeader({
  children,
  href
}: {
  children?: ReactNode;
  href?: string;
}) {
  return (
    <header className="screen__top">
      <BrandMark href={href} />
      {children}
    </header>
  );
}
