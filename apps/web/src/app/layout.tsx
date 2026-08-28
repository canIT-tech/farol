import type { ReactNode } from "react";

export const metadata = {
  title: "Farol",
  description: "O assessor que guia a viagem inteira."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
