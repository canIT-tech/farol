import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteForm } from "./RouteForm";
import { emptyRouteForm } from "../../lib/route-form";

afterEach(cleanup);

describe("RouteForm", () => {
  it("devolve o estado ao mudar um campo", async () => {
    const onChange = vi.fn();
    render(
      <RouteForm
        state={emptyRouteForm()}
        onChange={onChange}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    await userEvent.type(screen.getByLabelText("Origem"), "F");
    expect(onChange).toHaveBeenCalledWith({ ...emptyRouteForm(), origin: "F" });
  });

  it("devolve o destino ao digitar", async () => {
    const onChange = vi.fn();
    render(
      <RouteForm
        state={emptyRouteForm()}
        onChange={onChange}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    await userEvent.type(screen.getByLabelText("Destino"), "S");
    expect(onChange).toHaveBeenCalledWith({ ...emptyRouteForm(), destination: "S" });
  });

  it("devolve a data de ida", () => {
    const onChange = vi.fn();
    render(
      <RouteForm
        state={emptyRouteForm()}
        onChange={onChange}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    fireEvent.change(screen.getByLabelText("Ida"), { target: { value: "2027-02-11" } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyRouteForm(), depart: "2027-02-11" });
  });

  it("devolve a data de volta", () => {
    const onChange = vi.fn();
    render(
      <RouteForm
        state={emptyRouteForm()}
        onChange={onChange}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    fireEvent.change(screen.getByLabelText("Volta"), { target: { value: "2027-02-25" } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyRouteForm(), return: "2027-02-25" });
  });

  it("esconde a data de volta na ida só", () => {
    render(
      <RouteForm
        state={{ ...emptyRouteForm(), tripType: "one-way" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    expect(screen.queryByLabelText("Volta")).toBeNull();
  });

  it("mostra a data de volta na ida e volta", () => {
    render(
      <RouteForm
        state={emptyRouteForm()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    expect(screen.getByLabelText("Volta")).toBeInTheDocument();
  });

  it("troca o tipo de viagem", async () => {
    const onChange = vi.fn();
    render(
      <RouteForm
        state={emptyRouteForm()}
        onChange={onChange}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    await userEvent.selectOptions(screen.getByLabelText("Viagem"), "one-way");
    expect(onChange).toHaveBeenCalledWith({ ...emptyRouteForm(), tripType: "one-way" });
  });

  it("muda o número de adultos", async () => {
    const onChange = vi.fn();
    render(
      <RouteForm
        state={emptyRouteForm()}
        onChange={onChange}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    await userEvent.type(screen.getByLabelText("Adultos"), "2");
    expect(onChange).toHaveBeenCalledWith({ ...emptyRouteForm(), adults: 12 });
  });

  it("submete sem recarregar a página", async () => {
    const onSubmit = vi.fn();
    render(
      <RouteForm
        state={{ ...emptyRouteForm(), origin: "FLN", destination: "SYD" }}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        pending={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("desabilita o botão enquanto busca", () => {
    render(
      <RouteForm state={emptyRouteForm()} onChange={vi.fn()} onSubmit={vi.fn()} pending />
    );
    expect(screen.getByRole("button", { name: "Buscando…" })).toBeDisabled();
  });
});
