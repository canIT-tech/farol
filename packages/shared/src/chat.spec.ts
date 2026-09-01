import { describe, it, expect } from "vitest";
import {
  ChatMessageRoleSchema,
  ToolCallSchema,
  ChatMessageDtoSchema,
  ChatRequestDtoSchema,
  ChatResponseDtoSchema
} from "./chat.js";

describe("Chat DTO Schemas", () => {
  it("validates valid roles", () => {
    expect(ChatMessageRoleSchema.parse("user")).toBe("user");
    expect(ChatMessageRoleSchema.parse("assistant")).toBe("assistant");
    expect(ChatMessageRoleSchema.parse("tool")).toBe("tool");
    expect(ChatMessageRoleSchema.parse("system")).toBe("system");
    expect(() => ChatMessageRoleSchema.parse("invalid")).toThrow();
  });

  it("validates tool calls", () => {
    const valid = { id: "call_1", name: "set_destination", args: { iata: "FOR" } };
    expect(ToolCallSchema.parse(valid)).toEqual(valid);
    expect(() => ToolCallSchema.parse({ id: "1" })).toThrow();
  });

  it("validates chat message DTO", () => {
    const valid = {
      role: "assistant" as const,
      content: "Destino alterado com sucesso."
    };
    expect(ChatMessageDtoSchema.parse(valid)).toEqual(valid);
  });

  it("validates chat request DTO", () => {
    expect(ChatRequestDtoSchema.parse({ message: "Mudar datas para outubro" })).toEqual({
      message: "Mudar datas para outubro"
    });
    expect(() => ChatRequestDtoSchema.parse({ message: "" })).toThrow();
  });

  it("validates chat response DTO", () => {
    const res = {
      message: { role: "assistant" as const, content: "Ok" },
      tripState: { id: "trip-1" }
    };
    expect(ChatResponseDtoSchema.parse(res)).toEqual(res);
  });
});
