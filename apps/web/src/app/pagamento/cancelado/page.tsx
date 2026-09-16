"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@farol/ui";
import { AuthGate } from "../../../components/AuthGate";
import { BrandHeader } from "../../../components/common/BrandHeader";
import { takeReturnTo } from "../../../lib/return-to";

function Cancelado() {
  const router = useRouter();
  const [returnTo] = useState(() => takeReturnTo());

  return (
    <main className="screen">
      <BrandHeader href="/trips" />
      <div className="screen__card">
        <h1 className="screen__title">Tudo bem, nada foi cobrado.</h1>
        <p className="screen__sub">Sua viagem continua onde estava. Quando quiser, a compra está lá.</p>
        <Button type="button" onClick={() => router.replace(returnTo)}>
          Voltar
        </Button>
      </div>
    </main>
  );
}

export default function PagamentoCanceladoPage() {
  return <AuthGate>{() => <Cancelado />}</AuthGate>;
}
