#!/usr/bin/env node
// Bate nos 9 endpoints do Travelpayouts com a conta de verdade e imprime uma
// amostra normalizada de cada um. Serve para (a) conferir que a conta continua
// liberando os mesmos endpoints e (b) perceber quando as fixtures em
// src/travelpayouts/__fixtures__ ficarem defasadas do shape real.
//
//   pnpm --filter @farol/providers build
//   doppler run -- node packages/providers/scripts/smoke-travelpayouts.mjs
//
// Só leitura: nenhuma chamada aqui escreve nada, nem no Travelpayouts nem no Farol.
import { TravelpayoutsFlightProvider, TravelpayoutsGeoProvider } from "../dist/index.js";

const token = process.env.TRAVELPAYOUTS_TOKEN;
if (!token) {
  console.error("TRAVELPAYOUTS_TOKEN ausente. Rode com `doppler run --`.");
  process.exit(1);
}
const marker = process.env.TRAVELPAYOUTS_MARKER ?? "farol-smoke";

const flights = new TravelpayoutsFlightProvider({ token, marker });
const geo = new TravelpayoutsGeoProvider({ token });

// Rota longa e com muita oferta: se ela vier vazia, é sinal de problema na conta.
const params = {
  originIata: process.env.SMOKE_ORIGIN ?? "GRU",
  destinationIata: process.env.SMOKE_DESTINATION ?? "LIS",
  departDate: process.env.SMOKE_DEPART ?? "2026-11-10",
  returnDate: process.env.SMOKE_RETURN ?? "2026-11-20",
  adults: 2,
  children: 0
};
const route = { originIata: params.originIata, destinationIata: params.destinationIata };

let failures = 0;

async function check(label, run, describe) {
  try {
    const rows = await run();
    console.log(`\n### ${label} → ${rows.length} item(ns)`);
    for (const row of rows.slice(0, 3)) {
      console.log("   ", describe(row));
    }
    if (rows.length === 0) {
      console.log("    (vazio — pode ser rota sem cache, não necessariamente erro)");
    }
  } catch (err) {
    failures += 1;
    console.log(`\n### ${label} → FALHOU: ${err.message}`);
  }
}

await check("search — /v1/prices/cheap + /v2/prices/nearest-places-matrix",
  () => flights.search(params),
  (o) => `${o.carrier} ${o.price} ${o.stops} escala(s) ${o.departAt.slice(0, 16)} ${o.deepLink.slice(0, 60)}`);

await check("nearbyOptions — /v2/prices/nearest-places-matrix",
  () => flights.nearbyOptions(params), (o) => `${o.id} ${o.price}`);

await check("cheapest — /v1/prices/cheap",
  () => flights.cheapest(params), (o) => `${o.carrier} ${o.price}`);

await check("priceCalendar — /v2/prices/month-matrix",
  () => flights.priceCalendar(route), (s) => `${s.departDate} ${s.price} ${s.gate ?? "-"}`);

await check("latestPrices — /v2/prices/latest",
  () => flights.latestPrices(route), (s) => `${s.departDate}→${s.returnDate ?? "-"} ${s.price}`);

await check("monthlyPrices — /v1/prices/monthly",
  () => flights.monthlyPrices(route), (d) => `${d.key} ${d.airline} ${d.price}`);

await check("cityDirections — /v1/city-directions",
  () => flights.cityDirections(params.originIata), (d) => `${d.destination} ${d.airline} ${d.price}`);

await check("whereami — /whereami",
  async () => { const p = await geo.whereami("191.240.129.27"); return p === null ? [] : [p]; },
  (p) => `${p.iata} ${p.name}, ${p.countryName}`);

await check("airports.json — /data/en/airports.json",
  () => geo.searchAirports("guarul"), (a) => `${a.iata} ${a.name}`);

await check("airlines.json — /data/en/airlines.json",
  async () => { const a = await geo.airline("LA"); return a === null ? [] : [a]; },
  (a) => `${a.code} ${a.name}`);

console.log(failures === 0 ? "\nOK — os 9 endpoints responderam." : `\n${failures} endpoint(s) falharam.`);
process.exit(failures === 0 ? 0 : 1);
