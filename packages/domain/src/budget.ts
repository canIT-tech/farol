/**
 * Custo estimado (voo + hospedagem + gastos locais) cabe no orçamento por pessoa?
 * Stub inicial — o pré-filtro completo de destinos entra no Plano 3.
 */
export function withinBudget(estimatedCost: number, budgetPerPerson: number): boolean {
  return estimatedCost <= budgetPerPerson;
}
