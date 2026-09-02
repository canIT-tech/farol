import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatRepository } from "./chat.repository";
import type { Database } from "@farol/db";

describe("ChatRepository", () => {
  let repository: ChatRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn()
    };
    repository = new ChatRepository(mockDb as unknown as Database);
  });

  it("lists message history ordered by createdAt asc", async () => {
    const mockRows = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        tripId: "550e8400-e29b-41d4-a716-446655440001",
        role: "user",
        content: "Olá",
        toolCalls: null,
        toolCallId: null,
        name: null,
        createdAt: new Date("2026-08-31T10:00:00Z")
      }
    ];

    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(mockRows)
    };
    mockDb.select.mockReturnValue(chain);

    const history = await repository.listHistory("550e8400-e29b-41d4-a716-446655440001");
    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe("user");
    expect(history[0]?.content).toBe("Olá");
  });

  it("saves a message to chat_messages table", async () => {
    const mockRow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      tripId: "550e8400-e29b-41d4-a716-446655440001",
      role: "user",
      content: "Quero mudar o destino",
      toolCalls: null,
      toolCallId: null,
      name: null,
      createdAt: new Date("2026-08-31T10:00:00Z")
    };
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockRow])
    };
    mockDb.insert.mockReturnValue(chain);


    const saved = await repository.saveMessage("t1", {
      role: "user",
      content: "Quero mudar o destino"
    });

    expect(mockDb.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    );
    expect(saved.role).toBe("user");
  });

  it("preserva o id quando a mensagem já vem com um", async () => {
    const row = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      tripId: "550e8400-e29b-41d4-a716-446655440001",
      role: "user",
      content: "oi",
      toolCalls: null,
      toolCallId: null,
      name: null,
      createdAt: new Date("2026-08-31T10:00:00Z")
    };
    const chain = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([row]) };
    mockDb.insert.mockReturnValue(chain);
    await repository.saveMessage("t1", { id: "msg-fixo", role: "user", content: "oi" });
    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({ id: "msg-fixo" }));
  });


  it("campos ausentes viram null nas values do insert", async () => {
    const mockRow = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      tripId: "550e8400-e29b-41d4-a716-446655440001",
      role: "assistant",
      content: null,
      toolCalls: null,
      toolCallId: null,
      name: null,
      createdAt: new Date("2026-08-31T10:00:00Z")
    };
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockRow])
    };
    mockDb.insert.mockReturnValue(chain);

    await repository.saveMessage("t1", { role: "assistant" });

    const values = chain.values.mock.calls[0]![0] as Record<string, unknown>;
    expect(values.content).toBeNull();
    expect(values.toolCalls).toBeNull();
    expect(values.toolCallId).toBeNull();
    expect(values.name).toBeNull();
  });

  it("campos presentes chegam nas values", async () => {
    const chain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          tripId: "550e8400-e29b-41d4-a716-446655440001",
          role: "tool",
          content: "{}",
          toolCalls: null,
          toolCallId: "c-1",
          name: "set_budget",
          createdAt: new Date("2026-08-31T10:00:00Z")
        }
      ])
    };
    mockDb.insert.mockReturnValue(chain);

    await repository.saveMessage("t1", {
      role: "tool",
      content: "{}",
      toolCallId: "c-1",
      name: "set_budget",
      toolCalls: [{ id: "c-1", name: "set_budget", args: {} }]
    });

    const values = chain.values.mock.calls[0]![0] as Record<string, unknown>;
    expect(values.toolCallId).toBe("c-1");
    expect(values.name).toBe("set_budget");
    expect(values.toolCalls).toHaveLength(1);
  });
});
