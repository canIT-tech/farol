#!/usr/bin/env node
/**
 * Pesquisa de destinos para a curadoria do catálogo.
 *
 * O `/v1/city-directions` sabe de onde se voa para onde e por quanto — mas não
 * sabe se o lugar combina com "praia e gastronomia", em que meses vale ir, nem
 * quanto custa dormir lá. Por isso ele entra aqui, fora do caminho da
 * requisição: o script levanta candidatos e o resto continua sendo curadoria
 * humana.
 *
 * Só lê. Escreve um CSV de rascunho ao lado do catálogo; nada é aplicado
 * sozinho ao banco.
 *
 *   doppler run -- pnpm --filter @farol/db research:destinations
 *   doppler run -- pnpm --filter @farol/db research:destinations -- --origins GRU,GIG
 */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(HERE, "..", "data", "destinations.csv");
const OUT = join(HERE, "..", "data", "destination-candidates.csv");

// Origens com malha aérea relevante no Brasil. Cada uma devolve ~30 destinos;
// o que aparece a partir de muitas é o que a maioria consegue alcançar.
const DEFAULT_ORIGINS = [
  "GRU", "GIG", "BSB", "CNF", "POA", "REC", "SSA", "FOR", "CWB", "VCP", "BEL", "MAO"
];

const BASE = process.env.TRAVELPAYOUTS_BASE_URL ?? "https://api.travelpayouts.com";
const CURRENCY = process.env.TRAVELPAYOUTS_CURRENCY ?? "brl";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: { "x-access-token": token } });
  if (!res.ok) {
    throw new Error(`${path} respondeu ${res.status}`);
  }
  return res.json();
}

/** Mediana em vez de média: uma tarifa promocional isolada não move o número. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

/** Mês da partida, para mostrar em que época a tarifa apareceu. */
function monthOf(iso) {
  return Number(String(iso).slice(5, 7));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    console.error("TRAVELPAYOUTS_TOKEN ausente. Rode com: doppler run -- ...");
    process.exit(1);
  }

  const origins = (arg("origins") ?? DEFAULT_ORIGINS.join(",")).split(",").map((o) => o.trim());
  const originCities = new Set();

  const [cities, countries, airports] = await Promise.all([
    get("/data/pt/cities.json", token),
    get("/data/pt/countries.json", token),
    get("/data/pt/airports.json", token)
  ]);
  const cityByCode = new Map(cities.map((c) => [c.code, c]));
  const countryByCode = new Map(countries.map((c) => [c.code, c]));
  // O city-directions responde em código de cidade (RIO), e o catálogo guarda
  // aeroporto (GIG). Sem esta tradução, o Rio voltaria como "novo destino".
  const cityOf = new Map(airports.map((a) => [a.code, a.city_code]));
  const toCity = (iata) => cityOf.get(iata) ?? iata;

  const catalogued = readFileSync(CATALOG, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split(",")[2]);
  const known = new Set(catalogued.flatMap((iata) => [iata, toCity(iata)]));

  // destino -> { prices, months, transfers, origins }
  const found = new Map();
  for (const origin of origins) {
    originCities.add(origin);
    originCities.add(toCity(origin));
    let data;
    try {
      const body = await get(
        `/v1/city-directions?origin=${origin}&currency=${CURRENCY}`,
        token
      );
      data = body.data ?? {};
    } catch (err) {
      console.error(`  ${origin}: ${err.message}`);
      continue;
    }
    const entries = Object.entries(data);
    console.error(`  ${origin}: ${entries.length} destinos`);
    for (const [iata, deal] of entries) {
      const acc = found.get(iata) ?? { prices: [], months: new Set(), transfers: [], origins: new Set() };
      acc.prices.push(deal.price);
      acc.months.add(monthOf(deal.departure_at));
      acc.transfers.push(deal.transfers);
      acc.origins.add(origin);
      found.set(iata, acc);
    }
  }

  const rows = [];
  for (const [iata, acc] of found) {
    // A própria origem aparece na lista de destinos de outra origem.
    if (known.has(iata) || originCities.has(iata)) continue;
    const city = cityByCode.get(iata);
    if (city === undefined || city.has_flightable_airport === false) continue;
    const country = countryByCode.get(city.country_code);
    // O dump pt deixa `name` vazio em algumas cidades (Curitiba, por exemplo).
    const name = city.name || city.name_translations?.pt || city.name_translations?.en || iata;
    rows.push({
      city: name,
      country: country?.name ?? city.country_code,
      iata,
      countryCode: city.country_code,
      region: city.country_code === "BR" ? "brasil" : "",
      origins: acc.origins.size,
      minPrice: Math.min(...acc.prices),
      medianPrice: median(acc.prices),
      minTransfers: Math.min(...acc.transfers),
      monthsSeen: [...acc.months].sort((a, b) => a - b).join(";"),
      lat: city.coordinates?.lat ?? "",
      lon: city.coordinates?.lon ?? ""
    });
  }

  // Alcance primeiro, preço depois: um destino que sai de dez capitais serve a
  // mais gente do que uma passagem barata a partir de uma só.
  rows.sort((a, b) => b.origins - a.origins || a.medianPrice - b.medianPrice);

  const header = [
    "city", "country", "iata", "tags", "bestMonths", "avgFlightCostFromGru",
    "avgLodgingNight", "avgDailyLocal", "region", "visaFreeBr",
    "_origensQueVoam", "_precoMin", "_mesesObservados", "_escalasMin", "_lat", "_lon", "_countryCode"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.city, r.country, r.iata,
        "", // tags — curadoria
        "", // bestMonths — curadoria; _mesesObservados é só onde havia tarifa
        r.medianPrice,
        "", // avgLodgingNight — curadoria
        "", // avgDailyLocal — curadoria
        r.region, // vazio fora do Brasil: precisa decidir a região
        "", // visaFreeBr — curadoria, é dado jurídico e muda
        r.origins, r.minPrice, r.monthsSeen, r.minTransfers, r.lat, r.lon, r.countryCode
      ].map(csvCell).join(",")
    );
  }
  writeFileSync(OUT, lines.join("\n") + "\n");

  console.error("");
  console.error(`${rows.length} candidatos fora do catálogo (${known.size} já catalogados).`);
  console.error(`Rascunho em ${OUT}`);
  console.error("");
  console.error("As colunas com _ são evidência da API, não vão para o banco.");
  console.error("tags, bestMonths, avgLodgingNight, avgDailyLocal, region e visaFreeBr");
  console.error("ficam em branco de propósito: são curadoria, e inventar número aqui");
  console.error("contamina a estimativa de custo que a descoberta mostra na tela.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
