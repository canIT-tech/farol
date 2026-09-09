import type { ProviderSection, RouteDeal } from "@farol/shared";
import { cheapestDeal, monthLabel } from "../../lib/route-form";
import { money } from "../../lib/money";

export function MonthList({
  section,
  onPick
}: {
  section: ProviderSection<RouteDeal>;
  onPick: (departDate: string) => void;
}) {
  if (section.error !== null) {
    return (
      <p className="rotas__aviso" role="status">
        não consegui consultar os meses agora — o provider não respondeu
      </p>
    );
  }
  // Vazio aqui não é falha: o /v1/prices/monthly serve cache do parceiro, e uma
  // rota que quase ninguém pesquisa simplesmente não tem linha. Dizer isso é
  // mais honesto do que trocar a rota da pessoa por um hub sem avisar.
  if (section.offers.length === 0) {
    return (
      <p className="rotas__aviso" role="status">
        sem histórico de preço para essa rota — escolha uma data e busque direto
      </p>
    );
  }
  const cheapest = cheapestDeal(section.offers);
  return (
    <ul className="rotas__meses" data-testid="month-list">
      {section.offers.map((deal) => {
        const isCheapest = cheapest !== null && deal.key === cheapest.key;
        return (
          <li key={deal.key}>
            <button
              type="button"
              className={isCheapest ? "rotas__mes rotas__mes--barato" : "rotas__mes"}
              data-testid={isCheapest ? "cheapest-month" : undefined}
              onClick={() => onPick(deal.departAt.slice(0, 10))}
            >
              <span className="rotas__mes-nome">{monthLabel(deal.key)}</span>
              <span className="rotas__mes-preco">{money(deal.price, deal.currency)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
