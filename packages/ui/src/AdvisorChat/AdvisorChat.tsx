import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import "./AdvisorChat.css";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string };

export type AdvisorChatProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  pending?: boolean;
  placeholder?: string;
};

export function AdvisorChat({
  messages,
  onSend,
  pending = false,
  placeholder = "Peça um ajuste…"
}: AdvisorChatProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const canSend = draft.trim().length > 0 && !pending;

  useEffect(() => {
    // O container sempre renderiza, então a ref existe após o mount.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const el = listRef.current!;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  function submit() {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="farol-chat">
      <div className="farol-chat__list" ref={listRef} role="log" aria-live="polite">
        {messages.map((m) => (
          <p key={m.id} className={`farol-chat__bubble farol-chat__bubble--${m.role}`}>
            {m.content}
          </p>
        ))}
        {pending && (
          <p className="farol-chat__bubble farol-chat__bubble--assistant farol-chat__pending">
            <span className="farol-chat__typing" aria-label="Assessor está respondendo" />
          </p>
        )}
      </div>

      <div className="farol-chat__composer">
        <textarea
          className="farol-chat__input"
          rows={1}
          value={draft}
          placeholder={placeholder}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Mensagem para o assessor"
        />
        <button
          type="button"
          className="farol-chat__send"
          aria-label="Enviar"
          disabled={!canSend}
          onClick={submit}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 12h10M12 7l5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
