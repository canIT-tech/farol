import { z } from "zod";
import type { LlmToolSpec } from "../llm/llm.types";

// As 11 tools do chat (design §6.4 da spec do MVP, que ainda fala em 9).
// parameters em zod: a mesma definição descreve a tool para o modelo e valida
// o args que volta. Antes era JSON Schema escrito à mão, duplicando o zod e
// sem validar nada de fato.
export const CHAT_TOOLS: LlmToolSpec[] = [
  {
    name: "set_destination",
    description: "Escolhe ou altera o destino final da viagem pelo código IATA (ex: 'FOR', 'REC').",
    parameters: z.object({
      iata: z.string().describe("Código IATA do destino candidato")
    })
  },
  {
    name: "shift_dates",
    description: "Altera as datas da viagem ou a duração em dias.",
    parameters: z.object({
      dateStart: z.string().optional().describe("Data de início em YYYY-MM-DD"),
      dateEnd: z.string().optional().describe("Data de término em YYYY-MM-DD"),
      durationDays: z.number().optional().describe("Duração em dias")
    })
  },
  {
    name: "set_budget",
    description: "Define ou atualiza o orçamento total em R$ (BRL).",
    parameters: z.object({
      budgetTotal: z.number().describe("Valor do orçamento em reais")
    })
  },
  {
    name: "add_interest",
    description: "Adiciona uma nova tag de interesse/gosto ao perfil do usuário.",
    parameters: z.object({
      tag: z.string().describe("Nome da tag de interesse (ex: 'gastronomia', 'praia')")
    })
  },
  {
    name: "remove_interest",
    description: "Remove uma tag de interesse do perfil do usuário.",
    parameters: z.object({
      tag: z.string().describe("Nome da tag a remover")
    })
  },
  {
    name: "regenerate_day",
    description:
      "Enfileira a regeneração completa dos itens de um determinado dia do roteiro (preserva os itens marcados como 'pinned').",
    parameters: z.object({
      dayIndex: z.number().describe("Índice do dia no roteiro (1-based)")
    })
  },
  {
    name: "remove_item",
    description: "Remove um item específico do roteiro pelo id.",
    parameters: z.object({
      itemId: z.string().describe("UUID do item do roteiro")
    })
  },
  {
    name: "pin_item",
    description:
      "Fixa ou desfixa um item do roteiro para que ele não seja alterado durante a regeneração do dia.",
    parameters: z.object({
      itemId: z.string().describe("UUID do item do roteiro"),
      pinned: z
        .boolean()
        .optional()
        .describe("True para fixar, false para desafixar. Padrão: true")
    })
  },
  {
    name: "find_hotel",
    description: "Busca opções de hotéis na região do destino.",
    parameters: z.object({
      near: z.string().optional().describe("Região ou referência de busca opcional")
    })
  },
  {
    name: "swap_restaurant",
    description: "Troca o restaurante de um item do tipo 'meal' por outro restaurante na mesma área.",
    parameters: z.object({
      itemId: z.string().describe("UUID do item do roteiro a trocar"),
      cuisine: z.string().optional().describe("Tipo de culinária (ex: 'italiana', 'sushi')")
    })
  },
  {
    name: "search_flights",
    description: "Busca opções de voos para a viagem.",
    parameters: z.object({})
  }
];
