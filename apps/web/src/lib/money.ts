// Um formatador — as três telas de preço (destino, booking, oferta) usavam
// cópias divergentes, e uma delas não fazia .toUpperCase() na moeda.
export function money(value: number, currency: string): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  });
}
