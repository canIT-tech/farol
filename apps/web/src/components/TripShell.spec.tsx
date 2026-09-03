import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShellFrame, TripShell } from "./TripShell";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace })
}));

const SESSION_OK = { data: { session: { access_token: "tok" } } };
const SESSION_NONE = { data: { session: null } };
let sessionResult: unknown = SESSION_OK;
const getSession = vi.fn(async () => sessionResult);
const authSignOut = vi.fn(async () => ({ error: null }));
vi.mock("../lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({ auth: { getSession, signOut: authSignOut } })
}));

const state = {
  id: TRIP_ID,
  userId: "22222222-2222-4222-8222-222222222222",
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: null,
  dateEnd: null,
  durationDays: 7,
  targetMonth: "2026-09",
  party: { adults: 2, children: 0 },
  budgetTotal: 12000,
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  destinations: [],
  chosenDestination: null
};

function okFetch() {
  return vi.fn(async () =>
    new Response(JSON.stringify(state), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  getSession.mockClear();
  sessionResult = SESSION_OK;
  vi.stubGlobal("fetch", okFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TripShell", () => {
  it("com sessão, renderiza a sidebar e o conteúdo dentro do shell", async () => {
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    expect(await screen.findByText("miolo")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("GRU")).toBeInTheDocument());
    expect(screen.getByLabelText("Assessor")).toBeInTheDocument();
  });

  it("clicar num passo concluído navega para ele", async () => {
    const lisboa = {
      iata: "LIS",
      city: "Lisboa",
      country: "Portugal",
      score: 0.8,
      rationale: "Justificativa longa o suficiente para passar no schema aqui.",
      estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
      climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
      flightTimeHours: null
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          // destino escolhido: "Escolher destino" vira etapa concluída e clicável
          JSON.stringify({ ...state, destinations: [lisboa], chosenDestination: lisboa }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    const link = await screen.findByRole("button", { name: "Escolher destino" });
    await userEvent.click(link);
    expect(push).toHaveBeenCalledWith(`/trips/${TRIP_ID}/discovery`);
  });

  it("a etapa de perfil sai do escopo da viagem e vai para o onboarding", async () => {
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    await userEvent.click(await screen.findByRole("button", { name: "Perfil de gosto" }));
    expect(push).toHaveBeenCalledWith("/onboarding");
  });

  it("a sidebar leva de volta para as viagens e permite sair", async () => {
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    await screen.findByText("miolo");
    expect(screen.getByRole("link", { name: "Minhas viagens" })).toHaveAttribute("href", "/trips");

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(authSignOut).toHaveBeenCalledTimes(1);
  });

  it("erro ao carregar mostra alerta com retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("500");

    vi.stubGlobal("fetch", okFetch());
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("miolo")).toBeInTheDocument();
  });

  it("o trilho manda a mensagem e mostra a resposta do assessor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return new Response(
            JSON.stringify({
              message: { role: "assistant", content: "Tirei o museu." },
              tripState: {}
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    await screen.findByText("miolo");
    await userEvent.type(screen.getByRole("textbox"), "tira o museu");
    await userEvent.click(screen.getByRole("button", { name: /[Ee]nviar/ }));
    expect(await screen.findByText("Tirei o museu.")).toBeInTheDocument();
  });

  it("erro do chat aparece no trilho sem derrubar a tela", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return new Response(null, { status: 503 });
        }
        return new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    await screen.findByText("miolo");
    await userEvent.type(screen.getByRole("textbox"), "oi");
    await userEvent.click(screen.getByRole("button", { name: /[Ee]nviar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("503");
    expect(screen.getByText("miolo")).toBeInTheDocument();
  });

  it("sem sessão, manda para o login", async () => {
    sessionResult = SESSION_NONE;
    render(
      <TripShell tripId={TRIP_ID}>
        <p>miolo</p>
      </TripShell>
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("miolo")).not.toBeInTheDocument();
  });

});

// /trips/new roda a mesma moldura sem viagem: o chat ainda não existe, então o
// trilho explica em vez de fingir uma conversa.
describe("ShellFrame sem viagem", () => {
  it("mostra a sidebar pendente e o trilho de apoio, sem campo de conversa", () => {
    render(
      <ShellFrame tripId={null} trip={null} onNavigate={vi.fn()}>
        <p>miolo</p>
      </ShellFrame>
    );

    expect(screen.getByText("miolo")).toBeInTheDocument();
    expect(screen.getAllByText("a definir")).toHaveLength(5);
    expect(screen.getByText("Assessor")).toBeInTheDocument();
    expect(screen.getByText(/A conversa abre assim que a viagem existir/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sair encerra a sessão e volta para a landing", async () => {
    render(
      <ShellFrame tripId={null} trip={null} onNavigate={vi.fn()}>
        <p>miolo</p>
      </ShellFrame>
    );
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
