"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "@farol/ui";
import { sendChat } from "../lib/trip-api";

export interface ChatState {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
}

// O histórico persiste em chat_messages no back, mas a api só devolve a
// resposta da vez — o trilho guarda a conversa da sessão. Toda resposta chama
// onChanged para a tela reler o TripState, já que a tool pode ter mexido nele.
export function useChat(
  token: string,
  tripId: string,
  onChanged: () => Promise<void> | void
): ChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      setMessages((current) => [
        ...current,
        { id: `u${current.length}`, role: "user", content: text }
      ]);
      setPending(true);
      setError(null);
      try {
        const response = await sendChat(token, tripId, text);
        setMessages((current) => [
          ...current,
          {
            id: response.message.id ?? `a${current.length}`,
            role: "assistant",
            content: response.message.content ?? ""
          }
        ]);
        await onChanged();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "não consegui falar com o assessor");
      } finally {
        setPending(false);
      }
    },
    [token, tripId, onChanged]
  );

  return { messages, pending, error, send };
}
