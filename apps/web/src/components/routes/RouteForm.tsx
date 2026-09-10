"use client";

import type { RouteFormState, TripType } from "../../lib/route-form";

export function RouteForm({
  state,
  onChange,
  onSubmit,
  pending
}: {
  state: RouteFormState;
  onChange: (next: RouteFormState) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const set = <K extends keyof RouteFormState>(key: K, value: RouteFormState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <form
      className="rotas__form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="rotas__campo">
        Origem
        <input
          value={state.origin}
          onChange={(e) => set("origin", e.target.value)}
          placeholder="FLN"
          maxLength={3}
        />
      </label>

      <label className="rotas__campo">
        Destino
        <input
          value={state.destination}
          onChange={(e) => set("destination", e.target.value)}
          placeholder="SYD"
          maxLength={3}
        />
      </label>

      <label className="rotas__campo">
        Viagem
        <select
          value={state.tripType}
          onChange={(e) => set("tripType", e.target.value as TripType)}
        >
          <option value="round-trip">Ida e volta</option>
          <option value="one-way">Só ida</option>
        </select>
      </label>

      <label className="rotas__campo">
        Ida
        <input type="date" value={state.depart} onChange={(e) => set("depart", e.target.value)} />
      </label>

      {/* Na ida só o campo some em vez de ficar desabilitado: uma data de volta
          visível numa busca de ida só é convite a achar que ela foi usada. */}
      {state.tripType === "round-trip" ? (
        <label className="rotas__campo">
          Volta
          <input
            type="date"
            value={state.return}
            onChange={(e) => set("return", e.target.value)}
          />
        </label>
      ) : null}

      <label className="rotas__campo">
        Adultos
        <input
          type="number"
          min={1}
          value={state.adults}
          onChange={(e) => set("adults", Number(e.target.value))}
        />
      </label>

      <button type="submit" className="rotas__buscar" disabled={pending}>
        {pending ? "Buscando…" : "Buscar"}
      </button>
    </form>
  );
}
