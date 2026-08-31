import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { chatMessages, type Database } from "@farol/db";
import { ChatMessageDtoSchema, type ChatMessageDto } from "@farol/shared";
import { DB } from "../db/db.module";

type Row = typeof chatMessages.$inferSelect;

function toDto(row: Row): ChatMessageDto {
  return ChatMessageDtoSchema.parse({
    id: row.id,
    tripId: row.tripId,
    role: row.role as ChatMessageDto["role"],
    content: row.content,
    toolCalls: row.toolCalls as ChatMessageDto["toolCalls"],
    toolCallId: row.toolCallId,
    name: row.name,
    createdAt: row.createdAt
  });
}


@Injectable()
export class ChatRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listHistory(tripId: string): Promise<ChatMessageDto[]> {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.tripId, tripId))
      .orderBy(asc(chatMessages.createdAt));
    return rows.map(toDto);
  }

  async saveMessage(tripId: string, message: ChatMessageDto): Promise<ChatMessageDto> {
    const id = message.id ?? crypto.randomUUID();
    const rows = await this.db
      .insert(chatMessages)
      .values({
        id,
        tripId,
        role: message.role,
        content: message.content ?? null,
        toolCalls: message.toolCalls ?? null,
        toolCallId: message.toolCallId ?? null,
        name: message.name ?? null
      })
      .returning();
    return toDto(rows[0] as Row);
  }
}
