// Regrava as fixtures de src/googleflights/__fixtures__ a partir do Google
// Flights real. Guarda só o payload do <script class="ds:1"> — o HTML inteiro
// passa de 3 MB e 99% dele é bundle de JS que o parser nunca olha.
//
//   node scripts/record-google-flights.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "src", "googleflights", "__fixtures__");

const CASES = [
  { name: "one-way", legs: [{ date: "2026-11-15", from: "GRU", to: "LIS" }], trip: 2 },
  {
    name: "round-trip",
    legs: [
      { date: "2026-11-15", from: "GRU", to: "LIS" },
      { date: "2026-11-25", from: "LIS", to: "GRU" }
    ],
    trip: 1
  },
  // Rota sem voo comercial: ilha remota do Atlântico Sul para outra do Pacífico.
  { name: "no-flights", legs: [{ date: "2026-11-15", from: "ASI", to: "PPT" }], trip: 2 }
];

function varint(n) {
  const out = [];
  for (;;) {
    const b = n & 0x7f;
    n >>>= 7;
    out.push(n ? b | 0x80 : b);
    if (!n) return Buffer.from(out);
  }
}
const tag = (f, w) => varint((f << 3) | w);
const ld = (f, p) => Buffer.concat([tag(f, 2), varint(p.length), p]);
const str = (f, s) => ld(f, Buffer.from(s, "utf8"));
const vi = (f, n) => Buffer.concat([tag(f, 0), varint(n)]);

function tfsOf({ legs, trip }) {
  const parts = legs.map((l) =>
    ld(3, Buffer.concat([str(2, l.date), ld(13, str(2, l.from)), ld(14, str(2, l.to))]))
  );
  return Buffer.concat([...parts, vi(8, 1), vi(9, 1), vi(19, trip)]).toString("base64");
}

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

for (const c of CASES) {
  const url = `https://www.google.com/travel/flights?tfs=${encodeURIComponent(tfsOf(c))}&hl=pt-BR&curr=BRL`;
  const res = await fetch(url, { headers: HEADERS });
  const html = await res.text();
  const m = html.match(/<script class="ds:1"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) {
    console.error(`${c.name}: ds:1 ausente (status ${res.status}, ${html.length} bytes)`);
    process.exitCode = 1;
    continue;
  }
  const raw = m[1];
  const body = raw.slice(raw.indexOf("data:") + 5, raw.lastIndexOf(","));
  writeFileSync(join(outDir, `${c.name}.json`), body);
  console.log(`${c.name}: ${body.length} bytes`);
}
