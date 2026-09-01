import { Inject, Injectable } from "@nestjs/common";
import type { ChatMessageDto, ChatResponseDto } from "@farol/shared";
import { TripsService } from "../trips/trips.service";
import { ChatRepository } from "./chat.repository";
import { ChatToolService } from "./chat-tools.service";
import { LLM, type LlmMessage, type LlmPort } from "../llm/llm.types";

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
    @Inject(LLM) private readonly llm: LlmPort
  ) {}

  async sendMessage(
    userId: string,
    tripId: string,
    userMessageText: string
  ): Promise<ChatResponseDto> {
    const initialState = await this.trips.get(userId, tripId);

    // 1. Salva mensagem do usuário
    const userMsg: ChatMessageDto = { role: "user", content: userMessageText };
    await this.repo.saveMessage(tripId, userMsg);

    // 2. Carrega histórico. A porta neutra tem a mesma forma do que está
    // persistido, então a tradução é campo a campo — sem montar blocos de
    // fornecedor à mão.
    const history = await this.repo.listHistory(tripId);
    const system = `${CHAT_SYSTEM_PROMPT}\n\nEstado atual da viagem:\n${JSON.stringify(initialState, null, 2)}`;
    const toolDefs = this.toolsService.getToolDefinitions();

    const messages: LlmMessage[] = history.map((msg) => ({
      // O papel "system" não existe na porta: o system vai em campo próprio.
      role: msg.role === "system" ? "user" : msg.role,
      content: msg.content ?? null,
      toolCalls: msg.toolCalls ?? undefined,
      toolCallId: msg.toolCallId ?? undefined,
      name: msg.name ?? undefined
    }));

    let turns = 0;
    let finalAssistantMsg: ChatMessageDto = { role: "assistant", content: "" };

    while (turns < MAX_TURNS) {
      turns++;

      const completion = await this.llm.chat({ system, messages, tools: toolDefs, tripId });
      const call = completion.toolCalls[0];

      if (call === undefined) {
        const textContent = completion.text.length > 0 ? completion.text : "Ação concluída.";
        finalAssistantMsg = { role: "assistant", content: textContent };
        await this.repo.saveMessage(tripId, finalAssistantMsg);
        break;
      }

      await this.repo.saveMessage(tripId, {
        role: "assistant",
        content: completion.text.length > 0 ? completion.text : null,
        toolCalls: [call]
      });

      const toolResult = await this.toolsService.executeTool(userId, tripId, {
        name: call.name,
        args: call.args
      });
      const toolResultText = JSON.stringify(toolResult);

      await this.repo.saveMessage(tripId, {
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: toolResultText
      });

      messages.push({ role: "assistant", content: null, toolCalls: [call] });
      messages.push({
        role: "tool",
        content: toolResultText,
        toolCallId: call.id,
        name: call.name
      });
    }

    const updatedState = await this.trips.get(userId, tripId);
    return {
      message: finalAssistantMsg,
      tripState: { ...updatedState }
    };
  }
}
