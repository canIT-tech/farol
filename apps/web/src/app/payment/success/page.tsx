"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@farol/ui";
import { AuthGate } from "../../../components/AuthGate";
import { BrandHeader } from "../../../components/common/BrandHeader";
import { useCreditsPolling } from "../../../hooks/useCreditsPolling";
import { takeCreditsBefore, takeReturnTo } from "../../../lib/return-to";

function Sucesso({ token }: { token: string }) {
  const router = useRouter();
  // Lidos uma vez: o sessionStorage é limpo na leitura.
  const [baseline] = useState(() => takeCreditsBefore());
  const [returnTo] = useState(() => takeReturnTo());
  const state = useCreditsPolling(token, baseline);

  useEffect(() => {
    if (state === "done") {
      router.replace(returnTo);
    }
  }, [state, returnTo, router]);

  return (
    <main className="screen">
      <BrandHeader href="/trips" />
      <div className="screen__card">
        {state === "timeout" ? (
          <>
            <h1 className="screen__title">Pagamento aprovado.</h1>
            <p className="screen__sub" role="status">
              O crédito aparece na sua conta em instantes — a confirmação da operadora está a
              caminho. Pode seguir; ele estará lá.
            </p>
            <Button type="button" onClick={() => router.replace(returnTo)}>
              Continuar
            </Button>
          </>
        ) : (
          <>
            <h1 className="screen__title">Confirmando com a operadora…</h1>
            <p className="screen__sub" role="status">
              Um instante. Assim que o crédito entrar, você volta para onde estava.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function PagamentoSucessoPage() {
  return <AuthGate>{(token) => <Sucesso token={token} />}</AuthGate>;
}
