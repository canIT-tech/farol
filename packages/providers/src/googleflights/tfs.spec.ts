import { describe, expect, it } from "vitest";
import { encodeTfs, type TfsQuery } from "./tfs.js";

// Os valores esperados foram gerados por um codificador protobuf independente
// (Python, sobre o mesmo flights.proto), não por esta implementação — senão a
// spec só provaria que o código concorda consigo mesmo.
const GRU_LIS: TfsQuery = {
  legs: [{ date: "2026-11-15", fromIata: "GRU", toIata: "LIS" }],
  adults: 1
};

describe("encodeTfs", () => {
  it("codifica uma ida simples", () => {
    expect(encodeTfs(GRU_LIS)).toBe("GhoSCjIwMjYtMTEtMTVqBRIDR1JVcgUSA0xJU0ABSAGYAQI=");
  });

  it("codifica ida e volta com dois adultos e uma criança", () => {
    expect(
      encodeTfs({
        legs: [
          { date: "2026-11-15", fromIata: "GRU", toIata: "LIS" },
          { date: "2026-11-25", fromIata: "LIS", toIata: "GRU" }
        ],
        adults: 2,
        children: 1
      })
    ).toBe(
      "GhoSCjIwMjYtMTEtMTVqBRIDR1JVcgUSA0xJUxoaEgoyMDI2LTExLTI1agUSA0xJU3IFEgNHUlVAAUABQAJIAZgBAQ=="
    );
  });

  it("codifica o limite de escalas", () => {
    expect(encodeTfs({ ...GRU_LIS, maxStops: 0 })).toBe(
      "GhwSCjIwMjYtMTEtMTUoAGoFEgNHUlVyBRIDTElTQAFIAZgBAg=="
    );
  });

  // 3000 não cabe em sete bits: prova que o varint encadeia bytes em vez de
  // truncar. Sem este caso, um encoder de um byte só passaria em tudo.
  it("codifica um teto de preço acima de 127", () => {
    expect(encodeTfs({ ...GRU_LIS, maxPrice: 3000 })).toBe(
      "GhoSCjIwMjYtMTEtMTVqBRIDR1JVcgUSA0xJU0ABSAFguBeYAQI="
    );
  });

  it("codifica a classe de cabine", () => {
    expect(encodeTfs({ ...GRU_LIS, seat: "business" })).toBe(
      "GhoSCjIwMjYtMTEtMTVqBRIDR1JVcgUSA0xJU0ABSAOYAQI="
    );
  });

  // O tipo de viagem não é um parâmetro: uma perna é ida, duas são ida e volta.
  // Deixar quem chama informar abriria a chance de dizer "ida" com duas pernas.
  it("deduz ida e volta pelo número de pernas", () => {
    const oneWay = encodeTfs(GRU_LIS);
    const roundTrip = encodeTfs({
      legs: [
        { date: "2026-11-15", fromIata: "GRU", toIata: "LIS" },
        { date: "2026-11-25", fromIata: "LIS", toIata: "GRU" }
      ],
      adults: 1
    });
    // O campo 19 (trip) é o último da mensagem: tag 0x98 0x01, depois o valor.
    // Comparar o sufixo em base64 não serviria — ele alinha de três em três
    // bytes, então o mesmo campo vira texto diferente conforme o tamanho total.
    expect([...Buffer.from(oneWay, "base64").subarray(-3)]).toEqual([0x98, 0x01, 2]);
    expect([...Buffer.from(roundTrip, "base64").subarray(-3)]).toEqual([0x98, 0x01, 1]);
  });

  it("recusa uma busca sem pernas", () => {
    expect(() => encodeTfs({ legs: [], adults: 1 })).toThrow(/perna/i);
  });

  it("recusa mais de nove passageiros, o teto do Google", () => {
    expect(() => encodeTfs({ ...GRU_LIS, adults: 9, children: 1 })).toThrow(/9/);
  });
});
