import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Farol — assessor de viagem",
  description:
    "Do “não sei para onde ir” a um roteiro pronto. Entre na lista dos primeiros a usar."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Travelpayouts — verificação de domínio + monetização dos links de afiliado */}
        <link rel="preconnect" href="https://tp-em.com" />
        <script
          data-cmp-ab="2"
          dangerouslySetInnerHTML={{
            __html: `(function () {
  var script = document.createElement("script");
  script.async = 1;
  script.setAttribute("data-cmp-ab", "2");
  script.src = "https://tp-em.com/NTY5NzM4.js?t=569738";
  document.head.appendChild(script);
})();`
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
