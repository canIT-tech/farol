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
    expect(chain.values).toHaveBeenCalled();
    expect(saved.role).toBe("user");
  });

});
