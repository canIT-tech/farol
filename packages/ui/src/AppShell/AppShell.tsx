import { useId, useState, type ReactNode } from "react";
import "./AppShell.css";

export type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  rail: ReactNode;
};

export function AppShell({ sidebar, children, rail }: AppShellProps) {
  const sidebarId = useId();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={["farol-shell", sidebarOpen && "farol-shell--sidebar-open"].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="farol-shell__nav-toggle"
        aria-expanded={sidebarOpen}
        aria-controls={sidebarId}
        onClick={() => setSidebarOpen((v) => !v)}
      >
        {sidebarOpen ? "Fechar menu" : "Menu"}
      </button>

      <aside
        id={sidebarId}
        className="farol-shell__sidebar"
        aria-label="Navegação da viagem"
      >
        {sidebar}
      </aside>

      <main className="farol-shell__main" aria-label="Conteúdo">
        {children}
      </main>

      <aside className="farol-shell__rail" aria-label="Assessor">
        {rail}
      </aside>
    </div>
  );
}
