import { describe, it, expect } from "vitest";
import type { flightSelections } from "@farol/db";
import { toFlightSelection } from "./flight-selection";

type Row = typeof flightSelections.$inferSelect;

const offer = {
  id: "off-1",
  price: 3980,
  currency: "BRL",
  carrier: "AF",
  stops: 1,
  departAt: "2026-09-10T18:30:00",
  arriveAt: "2026-09-11T14:10:00",
  returnAt: null,
  durationMinutes: 880,
  deepLink: "https://parceiro.example.com/voos?x=1"
};

function row(over: Partial<Row> = {}): Row {
  return {
    id: "sel-1",
    tripId: "t-1",
    offer,
    price: "3980.00",
    currency: "BRL",
    carrier: "AF",
    stops: 1,
    departAt: new Date("2026-09-10T18:30:00.000Z"),
    returnAt: null,
    deepLink: "https://parceiro.example.com/voos?x=1",
    selectedAt: new Date("2026-08-29T12:00:00.000Z"),
    ...over
  };
}

describe("toFlightSelection", () => {
  it("converte a linha (numérico → number, datas → ISO)", () => {
    expect(toFlightSelection(row())).toEqual({
      id: "sel-1",
      tripId: "t-1",
      offer,
      price: 3980,
      currency: "BRL",
      carrier: "AF",
      stops: 1,
      departAt: "2026-09-10T18:30:00.000Z",
      returnAt: null,
      deepLink: "https://parceiro.example.com/voos?x=1",
      selectedAt: "2026-08-29T12:00:00.000Z"
    });
  });

  it("mantém carrier/stops/departAt nulos e serializa returnAt quando presente", () => {
    const dto = toFlightSelection(
      row({
        carrier: null,
        stops: null,
        departAt: null,
        returnAt: new Date("2026-09-20T08:00:00.000Z")
      })
    );
    expect(dto.carrier).toBeNull();
    expect(dto.stops).toBeNull();
    expect(dto.departAt).toBeNull();
    expect(dto.returnAt).toBe("2026-09-20T08:00:00.000Z");
  });
});
