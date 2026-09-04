// Bate no Google Flights real e confere que o parser ainda entende a resposta.
// É o contrário das fixtures: aqui a rede é o ponto. Roda no job noturno e à
// mão quando houver suspeita de mudança de layout.
//
//   pnpm --filter @farol/providers smoke:google-flights
//
// Sai com código 1 se a busca não devolver oferta — o sinal de que o Google
// mexeu no layout e o FallbackFlightProvider passou a carregar sozinho.
import { GoogleFlightsProvider } from "../dist/index.js";

// Uma data no futuro próximo, calculada na hora: data fixa no código venceria e
// o smoke passaria a falhar por motivo errado.
const depart = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

const provider = new GoogleFlightsProvider({});
const { offers, priceContext } = await provider.searchWithContext({
  originIata: "GRU",
  destinationIata: "LIS",
  departDate: depart,
  adults: 1,
  children: 0
});

console.log(`GRU → LIS em ${depart}`);
console.log(`ofertas: ${offers.length}`);
for (const offer of offers.slice(0, 3)) {
  console.log(
    `  ${offer.currency} ${offer.price}  ${offer.carrierName ?? offer.carrier}  ` +
      `${offer.departAt.slice(11, 16)}→${offer.arriveAt.slice(11, 16)}  ` +
      `${offer.stops} escala(s)  ${offer.durationMinutes} min`
  );
}
console.log(
  priceContext === null
    ? "contexto de preço: ausente"
    : `contexto de preço: mais barato ${priceContext.cheapest}, típico ${priceContext.typical}, ` +
      `faixa ${priceContext.bandLow}–${priceContext.bandHigh}, ${priceContext.history.length} pontos`
);

if (offers.length === 0) {
  console.error("nenhuma oferta — o parser do Google Flights precisa de revisão");
  process.exit(1);
}
