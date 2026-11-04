import { COMPANY_IDENTIFICATION } from "../../lib/company";
import { splitEmailForDisplay } from "../../lib/seo";

// Identificação do fornecedor (Decreto 7.962/2013) com o e-mail partido em
// spans: o Email Obfuscation do Cloudflare não reconhece e não reescreve o HTML,
// e a hidratação do React segue batendo com o servidor.
const parts = splitEmailForDisplay(COMPANY_IDENTIFICATION);

export function CompanyIdentification() {
  return (
    <span>
      {parts.before}
      <span>{parts.user}</span>
      <span>@</span>
      <span>{parts.domain}</span>
      {parts.after}
    </span>
  );
}
