import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "./chat.service";
import type { TripsService } from "../trips/trips.service";
import type { ChatRepository } from "./chat.repository";
import type { ChatToolService } from "./chat-tools.service";
import type { LlmCompletion, LlmPort } from "../llm/llm.types";

function completionWithText(text: string): LlmCompletion {
  return { text, toolCalls: [], model: "m", usage: { inputTokens: 100, outputTokens: 20 } };
}

function completionWithToolCall(
  id: string,
  name: string,
  args: Record<string, unknown>,
  text = ""
): LlmCompletion {
  return {
    text,
    toolCalls: [{ id, name, args }],
    model: "m",
    usage: { inputTokens: 100, outputTokens: 30 }
  };
}

describe("ChatService", () => {
  let service: ChatService;
  let mockTrips: { get: ReturnType<typeof vi.fn> };
  let mockChatRepo: { saveMessage: ReturnType<typeof vi.fn>; listHistory: ReturnType<typeof vi.fn> };
  let mockChatTools: {
    getToolDefinitions: ReturnType<typeof vi.fn>;
    executeTool: ReturnType<typeof vi.fn>;
  };
  let mockLlm: { chat: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockTrips = {
      get: vi.fn().mockResolvedValue({
        id: "t1",
        title: "Viagem para Fortaleza",
        status: "draft",
        destinations: [{ iata: "FOR", city: "Fortaleza", country: "Brasil", chosen: true }]
      })
    };
    mockChatRepo = {
      saveMessage: vi
        .fn()
        .mockImplementation((_tId, msg) => Promise.resolve({ ...msg, id: "msg-1" })),
      listHistory: vi.fn().mockResolvedValue([{ role: "user", content: "Quero mudar o destino" }])
    };
    mockChatTools = {
      getToolDefinitions: vi
        .fn()
        .mockReturnValue([{ name: "set_destination", description: "sets dest" }]),
      executeTool: vi.fn().mockResolvedValue({ success: true, data: { itineraryId: "it-1" } })
    };
    mockLlm = { chat: vi.fn() };

    service = new ChatService(
      mockTrips as unknown as TripsService,
      mockChatRepo as unknown as ChatRepository,
      mockChatTools as unknown as ChatToolService,
      mockLlm as unknown as LlmPort
    );
  });

  it("resposta só de texto encerra o loop e persiste a mensagem", async () => {
    mockLlm.chat.mockResolvedValueOnce(completionWithText("Entendido! Como posso ajudar?"));

    const res = await service.sendMessage("u1", "t1", "Olá!");

    expect(res.message.role).toBe("assistant");
    expect(res.message.content).toBe("Entendido! Como posso ajudar?");
    expect(mockChatRepo.saveMessage).toHaveBeenCalled();
    expect(mockLlm.chat).toHaveBeenCalledOnce();
  });

  it("passa system, tools e tripId para a porta", async () => {
    mockLlm.chat.mockResolvedValueOnce(completionWithText("ok"));

    await service.sendMessage("u1", "t1", "Olá!");

    const request = mockLlm.chat.mock.calls[0]![0] as {
      system: string;
      tools: unknown[];
      tripId: string;
    };
    expect(request.tripId).toBe("t1");
    expect(request.tools).toHaveLength(1);
    // O estado da viagem vai no system para o modelo não precisar perguntar.
    expect(request.system).toContain("Fortaleza");
  });

  it("executa a tool, persiste os três turnos e encerra no texto final", async () => {
    mockChatRepo.listHistory.mockResolvedValueOnce([
      { role: "user", content: "Mudar o destino" },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "call_old", name: "set_destination", args: { iata: "REC" } }]
      },
      { role: "tool", toolCallId: "call_old", name: "set_destination", content: '{"success":true}' }
    ]);

    mockLlm.chat
      .mockResolvedValueOnce(completionWithToolCall("call_1", "set_destination", { iata: "FOR" }))
      .mockResolvedValueOnce(
        completionWithText("Destino alterado para Fortaleza com sucesso!")
      );

    const res = await service.sendMessage("u1", "t1", "Muda o destino para Fortaleza");

    expect(mockChatTools.executeTool).toHaveBeenCalledWith("u1", "t1", {
      name: "set_destination",
      args: { iata: "FOR" }
    });
    expect(res.message.content).toBe("Destino alterado para Fortaleza com sucesso!");

    // user + assistant(tool call) + tool(result) + assistant(final)
    expect(mockChatRepo.saveMessage).toHaveBeenCalledTimes(4);
  });

  it("traduz o histórico persistido para a porta sem montar bloco de fornecedor", async () => {
    mockChatRepo.listHistory.mockResolvedValueOnce([
      { role: "user", content: "oi" },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "c-1", name: "set_budget", args: { total: 5000 } }]
      },
      { role: "tool", toolCallId: "c-1", name: "set_budget", content: '{"success":true}' },
      // Papel system não existe na porta; vira user.
      { role: "system", content: "nota interna" }
    ]);
    mockLlm.chat.mockResolvedValueOnce(completionWithText("ok"));

    await service.sendMessage("u1", "t1", "oi");

    const messages = (mockLlm.chat.mock.calls[0]![0] as { messages: unknown[] }).messages as {
      role: string;
      toolCalls?: unknown[];
      toolCallId?: string;
    }[];
    expect(messages[1]!.toolCalls).toEqual([
      { id: "c-1", name: "set_budget", args: { total: 5000 } }
    ]);
    expect(messages[2]!.toolCallId).toBe("c-1");
    expect(messages[3]!.role).toBe("user");
  });

  it("texto vazio sem tool call cai no fallback 'Ação concluída.'", async () => {
    mockLlm.chat.mockResolvedValueOnce(completionWithText(""));

    const res = await service.sendMessage("u1", "t1", "?");

    expect(res.message.content).toBe("Ação concluída.");
  });

  it("tool call acompanhada de texto persiste o texto no turno da tool", async () => {
    mockLlm.chat
      .mockResolvedValueOnce(
        completionWithToolCall("c-2", "set_destination", { iata: "FOR" }, "Vou trocar já")
      )
      .mockResolvedValueOnce(completionWithText("Feito"));

    await service.sendMessage("u1", "t1", "troca");

    const assistantToolTurn = mockChatRepo.saveMessage.mock.calls.find(
      (call) => (call[1] as { toolCalls?: unknown[] }).toolCalls !== undefined
    )!;
    expect((assistantToolTurn[1] as { content: string | null }).content).toBe("Vou trocar já");
  });

  it("para em MAX_TURNS quando o modelo só chama tools", async () => {
    mockLlm.chat.mockResolvedValue(
      completionWithToolCall("c-loop", "set_destination", { iata: "FOR" })
    );

    await service.sendMessage("u1", "t1", "loop");

    expect(mockLlm.chat).toHaveBeenCalledTimes(5);
  });

  it("devolve o estado da viagem relido depois das mutações", async () => {
    mockLlm.chat.mockResolvedValueOnce(completionWithText("ok"));

    const res = await service.sendMessage("u1", "t1", "oi");

    // Uma leitura no começo (para o system) e uma no fim (estado atualizado).
    expect(mockTrips.get).toHaveBeenCalledTimes(2);
    expect(res.tripState).toMatchObject({ id: "t1" });
  });
});
