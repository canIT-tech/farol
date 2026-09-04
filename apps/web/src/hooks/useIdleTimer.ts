"use client";

import { useEffect, useRef } from "react";

/** Sinais de que ainda tem gente na frente da tela.
 *  `pointerdown` cobre mouse, toque e caneta numa só assinatura; `visibilitychange`
 *  conta a volta para a aba, que é vida sem ser clique nem tecla. */
export const IDLE_EVENTS = ["pointerdown", "keydown", "visibilitychange"] as const;

export interface IdleTimerOptions {
  /** Tempo de silêncio até chamar onIdle. */
  ms: number;
  onIdle: () => void;
  /** Falso desarma a contagem — útil enquanto não há sessão para encerrar. */
  enabled?: boolean;
}

/**
 * Dispara uma vez depois de `ms` sem sinal de atividade.
 *
 * Não é uma barreira de segurança: quem tem o token continua podendo usá-lo até
 * ele expirar, porque a api é stateless. O que isto protege é a tela deixada
 * aberta — máquina compartilhada, notebook no café.
 */
export function useIdleTimer({ ms, onIdle, enabled = true }: IdleTimerOptions): void {
  // Em refs para o efeito não reassinar os eventos a cada render de quem chama.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    // Uma vez só: um evento tardio não pode disparar um segundo logout em cima
    // do redirecionamento que já começou.
    let fired = false;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fired = true;
        onIdleRef.current();
      }, ms);
    };

    const bump = () => {
      if (!fired) {
        arm();
      }
    };

    for (const event of IDLE_EVENTS) {
      window.addEventListener(event, bump);
    }
    arm();

    return () => {
      clearTimeout(timer);
      for (const event of IDLE_EVENTS) {
        window.removeEventListener(event, bump);
      }
    };
  }, [ms, enabled]);
}
