import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "./chat.service";
import type { TripsService } from "../trips/trips.service";
import type { ChatRepository } from "./chat.repository";
import type { ChatToolService } from "./chat-tools.service";
import type { LlmService } from "../llm/llm.service";

describe("ChatService", () => {
  let service: ChatService;
  let mockTrips: any;
  let mockChatRepo: any;
  let mockChatTools: any;
  let mockLlm: any;

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
      saveMessage: vi.fn().mockImplementation((_tId, msg) => Promise.resolve({ ...msg, id: "msg-1" })),
      listHistory: vi.fn().mockResolvedValue([
        { role: "user", content: "Quero mudar o destino" }
      ])
    };
    mockChatTools = {
      getToolDefinitions: vi.fn().mockReturnValue([{ name: "set_destination", description: "sets dest" }]),
      executeTool: vi.fn().mockResolvedValue({ success: true, data: { itineraryId: "it-1" } })
    };
    mockLlm = {
      chat: vi.fn()
    };

    service = new ChatService(
      mockTrips as unknown as TripsService,
      mockChatRepo as unknown as ChatRepository,
      mockChatTools as unknown as ChatToolService,
      mockLlm as unknown as LlmService
    );
  });

  it("handles a simple assistant text response without tool calls", async () => {
    mockLlm.chat.mockResolvedValueOnce({
      content: [{ type: "text", text: "Entendido! Como posso ajudar?" }],
      usage: { input_tokens: 100, output_tokens: 20 }
    });

    const res = await service.sendMessage("u1", "t1", "Olá!");
    expect(res.message.role).toBe("assistant");
    expect(res.message.content).toBe("Entendido! Como posso ajudar?");
    expect(mockChatRepo.saveMessage).toHaveBeenCalled();
  });

  it("handles a tool call loop and saves all turns", async () => {
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
      .mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "call_1", name: "set_destination", input: { iata: "FOR" } }
        ],
        usage: { input_tokens: 100, output_tokens: 30 }
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Destino alterado para Fortaleza com sucesso!" }],
        usage: { input_tokens: 120, output_tokens: 25 }
      });

    const res = await service.sendMessage("u1", "t1", "Muda o destino para Fortaleza");
    expect(mockChatTools.executeTool).toHaveBeenCalledWith("u1", "t1", {
      name: "set_destination",
      args: { iata: "FOR" }
    });
    expect(res.message.content).toBe("Destino alterado para Fortaleza com sucesso!");
  });

});
