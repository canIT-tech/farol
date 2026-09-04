// Extração do payload de dados da página do Google Flights.
//
// A página embute os resultados num <script class="ds:1"> na forma
// `AF_initDataCallback({key: 'ds:1', hash: '9', data:[...], sideChannel: {}});`.
// Descoberta original de @kftang, pelo fast-flights.
//
// Uma regex basta e um parser de HTML não: procuramos uma tag conhecida por
// classe exata, não navegamos a árvore. Trazer cheerio para isso seria peso
// morto num pacote que hoje não tem nenhuma dependência de parsing.

export class GoogleFlightsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleFlightsParseError";
  }
}

// A classe é ancorada com aspas dos dois lados: sem isso "ds:1" casaria também
// com uma futura "ds:10", e o conteúdo é preguiçoso para parar no primeiro
// </script>.
const DS1 = /<script class="ds:1"[^>]*>([\s\S]*?)<\/script>/;

const MARKER = "data:";

export function extractPayload(html: string): unknown[] {
  const script = DS1.exec(html);
  if (script === null) {
    throw new GoogleFlightsParseError(
      "a página do Google Flights não trouxe o script ds:1 — o layout mudou ou a requisição foi bloqueada"
    );
  }

  // O grupo 1 existe sempre que o exec casou — a regex tem exatamente um.
  const body = script[1]!;
  if (body.includes("errorHasStatus")) {
    throw new GoogleFlightsParseError("o Google Flights recusou a busca");
  }

  const start = body.indexOf(MARKER);
  if (start === -1) {
    throw new GoogleFlightsParseError("o script ds:1 não tem o marcador data:");
  }

  // O payload vai do "data:" até a última vírgula, que separa o array do
  // `sideChannel` final. Recortar pelo fecho de colchete não funcionaria: o
  // array tem centenas deles aninhados.
  const json = body.slice(start + MARKER.length, body.lastIndexOf(","));

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new GoogleFlightsParseError("o payload do ds:1 não é JSON válido");
  }

  if (!Array.isArray(parsed)) {
    throw new GoogleFlightsParseError("o payload do ds:1 não é um array");
  }
  return parsed;
}
