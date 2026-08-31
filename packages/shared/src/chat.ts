import { z } from "zod";

export const ChatMessageRoleSchema = z.enum(["user", "assistant", "tool", "system"]);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.unknown())
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ChatMessageDtoSchema = z.object({
  id: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  role: ChatMessageRoleSchema,
  content: z.string().nullable().optional(),
  toolCalls: z.array(ToolCallSchema).nullable().optional(),
  toolCallId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional()
});
export type ChatMessageDto = z.infer<typeof ChatMessageDtoSchema>;

export const ChatRequestDtoSchema = z.object({
  message: z.string().min(1)
});
export type ChatRequestDto = z.infer<typeof ChatRequestDtoSchema>;

export const ChatResponseDtoSchema = z.object({
  message: ChatMessageDtoSchema,
  tripState: z.record(z.unknown())
});
export type ChatResponseDto = z.infer<typeof ChatResponseDtoSchema>;
