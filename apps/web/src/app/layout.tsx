import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "@farol/ui/tokens.css";
import "../styles/screen.css";
import "../styles/pane.css";
import "./globals.css";
import { JsonLd } from "./_seo/JsonLd";
import { SITE, organizationLd, resolveSiteUrl, websiteLd } from "../lib/seo";

const siteUrl = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

// Fontes servidas pelo próprio Next (sem CSS do Google bloqueando a pintura e
// com fallback ajustado para não pular layout). As variáveis alimentam
// --font-display / --font-body em globals.css e tokens.css.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-bricolage"
});
const text = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument"
});

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: SITE.title, template: `%s | ${SITE.shortName}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name, url: siteUrl }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "travel",
  alternates: { canonical: "/", languages: { "pt-BR": "/" } },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: "/",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 }
  },
  formatDetection: { email: false, telephone: false, address: false },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {})
  }
};

export const viewport: Viewport = {
  themeColor: "#c25a38",
  width: "device-width",
  initialScale: 1
};

// Travelpayouts (verificação do domínio + monetização dos links de afiliado).
// O script trava a main thread por ~700 ms; carregar só depois do `load` e do
// primeiro respiro do browser tira esse custo do LCP/TBT. A URL fica no HTML,
// que é onde a verificação do domínio procura.
const TRAVELPAYOUTS_LOADER = `(function () {
  function load() {
    var script = document.createElement("script");
    script.async = 1;
    script.setAttribute("data-cmp-ab", "2");
    script.src = "https://tp-em.com/NTY5NzM4.js?t=569738";
    document.head.appendChild(script);
  }
  function idle() {
    if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 4000 });
    else setTimeout(load, 2000);
  }
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${text.variable}`}>
      <head>
        <script data-cmp-ab="2" dangerouslySetInnerHTML={{ __html: TRAVELPAYOUTS_LOADER }} />
        <JsonLd data={[organizationLd(siteUrl), websiteLd(siteUrl)]} />
      </head>
      <body>{children}</body>
    </html>
  );
}
