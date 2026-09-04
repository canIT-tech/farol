import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Airport, GeoLocation } from "@farol/shared";
import { OriginField, airportLabel } from "./OriginField";

afterEach(cleanup);

const gru: Airport = {
  iata: "GRU",
  name: "São Paulo — Guarulhos",
  cityCode: "SAO",
  countryCode: "BR",
  timeZone: "America/Sao_Paulo",
  lat: -23.43,
  lon: -46.47,
  flightable: true
};

const chapeco: GeoLocation = {
  iata: "XAP",
  name: "Chapecó",
  countryName: "Brazil",
  countryCode: "BR",
  lat: -27.1,
  lon: -52.6
};

const noDetect = () => Promise.resolve(null);
const noSearch = () => Promise.resolve([]);

describe("airportLabel", () => {
  it("mostra nome e código", () => {
    expect(airportLabel(gru)).toBe("São Paulo — Guarulhos (GRU)");
  });
});

describe("OriginField — sugestão pelo IP", () => {
  it("preenche a origem e explica de onde veio o palpite", async () => {
    const onChange = vi.fn();
    render(
      <OriginField
        token="tok"
        value=""
        onChange={onChange}
        detectOrigin={() => Promise.resolve(chapeco)}
        findAirports={noSearch}
      />
    );

    expect(await screen.findByText(/Sugeri Chapecó \(XAP\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Saindo de")).toHaveValue("XAP");
    expect(onChange).toHaveBeenCalledWith("XAP");
  });

  it("não sobrescreve a origem que a pessoa já escolheu", async () => {
    const onChange = vi.fn();
    render(
      <OriginField
        token="tok"
        value="GIG"
        onChange={onChange}
        detectOrigin={() => Promise.resolve(chapeco)}
        findAirports={noSearch}
      />
    );

    expect(await screen.findByText(/Sugeri Chapecó \(XAP\)/)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("GIG");
  });

  it("segue utilizável quando a detecção falha", async () => {
    render(
      <OriginField
        token="tok"
        value=""
        onChange={vi.fn()}
        detectOrigin={() => Promise.reject(new Error("503"))}
        findAirports={noSearch}
      />
    );

    expect(await screen.findByLabelText("Saindo de")).toHaveValue("");
    expect(screen.getByText("Código IATA, cidade ou nome do aeroporto")).toBeInTheDocument();
  });
});

describe("OriginField — busca no catálogo", () => {
  it("não busca com termo de uma letra", async () => {
    const findAirports = vi.fn(() => Promise.resolve([gru]));
    render(<OriginField token="tok" value="" onChange={vi.fn()} detectOrigin={noDetect} findAirports={findAirports} />);

    await userEvent.type(screen.getByLabelText("Saindo de"), "g");
    expect(findAirports).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("lista os aeroportos encontrados a partir de duas letras", async () => {
    const findAirports = vi.fn(() => Promise.resolve([gru]));
    render(<OriginField token="tok" value="" onChange={vi.fn()} detectOrigin={noDetect} findAirports={findAirports} />);

    await userEvent.type(screen.getByLabelText("Saindo de"), "gua");

    expect(await screen.findByRole("listbox", { name: "Aeroportos encontrados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "São Paulo — Guarulhos (GRU)" })).toBeInTheDocument();
    expect(findAirports).toHaveBeenCalledWith("tok", "gua");
  });

  it("escolher um aeroporto fixa o código e mostra o nome completo", async () => {
    const onChange = vi.fn();
    render(
      <OriginField token="tok" value="" onChange={onChange} detectOrigin={noDetect} findAirports={() => Promise.resolve([gru])} />
    );

    await userEvent.type(screen.getByLabelText("Saindo de"), "gua");
    await userEvent.click(await screen.findByRole("button", { name: "São Paulo — Guarulhos (GRU)" }));

    expect(onChange).toHaveBeenLastCalledWith("GRU");
    expect(screen.getByLabelText("Saindo de")).toHaveValue("GRU");
    expect(screen.getByText("São Paulo — Guarulhos (GRU)")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("digitar de novo reabre a busca depois de uma escolha", async () => {
    const findAirports = vi.fn(() => Promise.resolve([gru]));
    render(<OriginField token="tok" value="" onChange={vi.fn()} detectOrigin={noDetect} findAirports={findAirports} />);

    await userEvent.type(screen.getByLabelText("Saindo de"), "gua");
    await userEvent.click(await screen.findByRole("button", { name: "São Paulo — Guarulhos (GRU)" }));
    await userEvent.type(screen.getByLabelText("Saindo de"), "x");

    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("aceita um IATA digitado direto, sem passar pela lista", async () => {
    const onChange = vi.fn();
    render(<OriginField token="tok" value="" onChange={onChange} detectOrigin={noDetect} findAirports={noSearch} />);

    await userEvent.type(screen.getByLabelText("Saindo de"), "gig");
    expect(onChange).toHaveBeenLastCalledWith("GIG");
  });

  it("termo com menos de 3 letras não vira origem válida", async () => {
    const onChange = vi.fn();
    render(<OriginField token="tok" value="" onChange={onChange} detectOrigin={noDetect} findAirports={noSearch} />);

    await userEvent.type(screen.getByLabelText("Saindo de"), "gi");
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("falha na busca deixa a lista vazia, sem quebrar o formulário", async () => {
    render(
      <OriginField
        token="tok"
        value=""
        onChange={vi.fn()}
        detectOrigin={noDetect}
        findAirports={() => Promise.reject(new Error("503"))}
      />
    );

    await userEvent.type(screen.getByLabelText("Saindo de"), "gua");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });
  it("a lista some quando o foco sai do campo e volta ao focar de novo", async () => {
    render(
      <OriginField
        token="tok"
        value=""
        onChange={vi.fn()}
        detectOrigin={noDetect}
        findAirports={() => Promise.resolve([gru])}
      />
    );

    const campo = screen.getByLabelText("Saindo de");
    await userEvent.type(campo, "gua");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    // Clicar fora: tab() iria para a primeira opção, que ainda é o container.
    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());

    campo.focus();
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("clicar numa opção não fecha a lista antes de registrar a escolha", async () => {
    const onChange = vi.fn();
    render(
      <OriginField
        token="tok"
        value=""
        onChange={onChange}
        detectOrigin={noDetect}
        findAirports={() => Promise.resolve([gru])}
      />
    );

    await userEvent.type(screen.getByLabelText("Saindo de"), "gua");
    await userEvent.click(await screen.findByRole("button", { name: "São Paulo — Guarulhos (GRU)" }));

    expect(onChange).toHaveBeenLastCalledWith("GRU");
  });
});
