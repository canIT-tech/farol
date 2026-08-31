import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ChatRequestDtoSchema, type ChatRequestDto, type ChatResponseDto, type User } from "@farol/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ChatService } from "./chat.service";

@Controller("trips")
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(":id/chat")
  async chat(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) tripId: string,
    @Body(new ZodValidationPipe(ChatRequestDtoSchema)) body: ChatRequestDto
  ): Promise<ChatResponseDto> {
    return this.chatService.sendMessage(user.id, tripId, body.message);
  }
}

