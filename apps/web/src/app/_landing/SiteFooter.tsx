import { CompanyIdentification } from "../../components/common/CompanyIdentification";

export default function SiteFooter() {
  return (
    <footer className="wrap">
      Farol Viagens · planejador de viagem com IA · <a href="/destinations">Destinos</a> ·{" "}
      <a href="/terms">Termos</a> · <a href="/privacy">Privacidade</a>
      <br />
      <CompanyIdentification />
    </footer>
  );
}
