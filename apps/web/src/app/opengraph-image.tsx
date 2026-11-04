import { ImageResponse } from "next/og";
import { Mark } from "./_seo/Mark";

// Imagem de compartilhamento (WhatsApp, Instagram, LinkedIn, X). 1200×630 é o
// tamanho que todos aceitam sem recorte.
export const alt = "Farol: planejador de viagem com IA, do gosto ao roteiro pronto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#faf8f5",
          color: "#1c1b19"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Mark size={88} />
          <span style={{ fontSize: 44, fontWeight: 700 }}>Farol Viagens</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 30, color: "#a5482c", fontWeight: 700, letterSpacing: 2 }}>
            PLANEJADOR DE VIAGEM COM IA
          </span>
          <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 980 }}>
            Você não precisa saber para onde ir.
          </span>
        </div>
        <span style={{ fontSize: 30, color: "#6b6963" }}>
          Do seu gosto ao roteiro pronto, dia a dia. 1ª viagem grátis.
        </span>
      </div>
    ),
    size
  );
}
