import { Body, Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import {
  ChatRequestDtoSchema,
  type ChatRequestDto,
  type ChatResponseDto,
  type CurrentUser as CurrentUserType
} from "@farol/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ChatService } from "./chat.service";

@Controller("trips")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(":id/chat")
  async chat(
    @CurrentUser() user: CurrentUserType,
    @Param("id", ParseUUIDPipe) tripId: string,
    @Body(new ZodValidationPipe(ChatRequestDtoSchema)) body: ChatRequestDto
  ): Promise<ChatResponseDto> {
    return this.chatService.sendMessage(user.id, tripId, body.message);
  }
}

