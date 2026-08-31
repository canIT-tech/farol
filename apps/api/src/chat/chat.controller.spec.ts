import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatController } from "./chat.controller";
import type { ChatService } from "./chat.service";
import type { User } from "@farol/shared";

describe("ChatController", () => {
  let controller: ChatController;
  let mockChatService: any;
  const user: User = { id: "u1", email: "user@example.com" };

  beforeEach(() => {
    mockChatService = {
      sendMessage: vi.fn().mockResolvedValue({
        message: { role: "assistant", content: "Ok" },
        tripState: { id: "t1" }
      })
    };
    controller = new ChatController(mockChatService as unknown as ChatService);
  });

  it("delegates POST /trips/:id/chat to ChatService.sendMessage", async () => {
    const result = await controller.chat(user, "t1", { message: "Quero ir para Fortaleza" });
    expect(mockChatService.sendMessage).toHaveBeenCalledWith("u1", "t1", "Quero ir para Fortaleza");
    expect(result).toEqual({
      message: { role: "assistant", content: "Ok" },
      tripState: { id: "t1" }
    });
  });
});
