import { Injectable } from "@nestjs/common";
import type { ChatMessageDto, ChatResponseDto } from "@farol/shared";
import { TripsService } from "../trips/trips.service";
import { ChatRepository } from "./chat.repository";
import { ChatToolService } from "./chat-tools.service";
import { LlmService } from "../llm/llm.service";

const MAX_TURNS = 5;

const CHAT_SYSTEM_PROMPT = `Você é o assistente virtual do Farol Viagens, um assessor calmo, confiável e prestativo.
Seu objetivo é ajudar o usuário a planejar a viagem, ajustando destino, datas, orçamento, gostos e itinerário.
Você tem ferramentas (tools) para executar ações diretamente na viagem e no perfil do usuário.
Sempre use as ferramentas apropriadas quando o usuário pedir alterações ou buscas.
Após executar uma ferramenta, explique brevemente o resultado de forma calma e natural.`;

@Injectable()
export class ChatService {
  constructor(
    private readonly trips: TripsService,
    private readonly repo: ChatRepository,
    private readonly toolsService: ChatToolService,
    private readonly llm: LlmService
  ) {}

  async sendMessage(
    userId: string,
    tripId: string,
    userMessageText: string
  ): Promise<ChatResponseDto> {
    const initialState = await this.trips.get(userId, tripId);

    // 1. Salva mensagem do usuário
    const userMsg: ChatMessageDto = {
      role: "user",
      content: userMessageText
    };
    await this.repo.saveMessage(tripId, userMsg);

    // 2. Carrega histórico e constrói mensagens para o Claude
    const history = await this.repo.listHistory(tripId);
    const system = `${CHAT_SYSTEM_PROMPT}\n\nEstado atual da viagem:\n${JSON.stringify(initialState, null, 2)}`;

    const toolDefs = this.toolsService.getToolDefinitions();

    const apiMessages: any[] = history.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: msg.content ?? ""
            }
          ]
        };
      }
      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: msg.toolCalls.map((tc) => ({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.args
          }))
        };
      }
      return {
        role: msg.role,
        content: msg.content ?? ""
      };
    });

    let turns = 0;
    let finalAssistantMsg: ChatMessageDto = { role: "assistant", content: "" };

    while (turns < MAX_TURNS) {
      turns++;

      const completion = await this.llm.chat({
        system,
        messages: apiMessages,
        tools: toolDefs
      });

      const contentBlocks = completion.content;
      const toolUseBlock = contentBlocks.find((b) => b.type === "tool_use");
      const textBlock = contentBlocks.find((b) => b.type === "text");

      if (toolUseBlock) {
        // Salva turno do assistente chamando a tool
        const assistantToolMsg: ChatMessageDto = {
          role: "assistant",
          content: textBlock?.text ?? null,
          toolCalls: [
            {
              id: toolUseBlock.id,
              name: toolUseBlock.name,
              args: toolUseBlock.input ?? {}
            }
          ]
        };
        await this.repo.saveMessage(tripId, assistantToolMsg);

        // Executa a tool
        const toolResult = await this.toolsService.executeTool(userId, tripId, {
          name: toolUseBlock.name,
          args: toolUseBlock.input ?? {}
        });

        // Salva resultado da tool
        const toolResultMsg: ChatMessageDto = {
          role: "tool",
          toolCallId: toolUseBlock.id,
          name: toolUseBlock.name,
          content: JSON.stringify(toolResult)
        };
        await this.repo.saveMessage(tripId, toolResultMsg);

        // Atualiza apiMessages para a próxima iteração
        apiMessages.push({
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: toolUseBlock.id,
              name: toolUseBlock.name,
              input: toolUseBlock.input ?? {}
            }
          ]
        });
        apiMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(toolResult)
            }
          ]
        });
      } else {
        // Resposta final em texto
        const textContent = textBlock?.text ?? "Ação concluída.";
        finalAssistantMsg = {
          role: "assistant",
          content: textContent
        };
        await this.repo.saveMessage(tripId, finalAssistantMsg);
        break;
      }
    }

    const updatedState = await this.trips.get(userId, tripId);
    return {
      message: finalAssistantMsg,
      tripState: updatedState
    };
  }
}
