import AppEntry from "./AppEntry";

// Navegação pública (landing e guias de destino). Links absolutos para as
// âncoras da home: funcionam de qualquer página e, na própria home, só rolam.
export default function SiteNav() {
  return (
    <nav className="nav" aria-label="Principal">
      <div className="wrap nav-inner">
        <a href="/" className="brand" aria-label="Farol Viagens, página inicial">
          Farol
        </a>
        <div className="nav-links">
          <a href="/#experiencia">Como funciona</a>
          <a href="/destinations">Destinos</a>
          <a href="/#precos">Preços</a>
          <AppEntry />
          <a href="/#lista" className="nav-cta">
            Entrar na lista
          </a>
        </div>
      </div>
    </nav>
  );
}
