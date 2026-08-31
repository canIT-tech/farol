export interface ChatToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const CHAT_TOOLS: ChatToolDefinition[] = [
  {
    name: "set_destination",
    description: "Escolhe ou altera o destino final da viagem pelo código IATA (ex: 'FOR', 'REC').",
    input_schema: {
      type: "object",
      properties: {
        iata: { type: "string", description: "Código IATA do destino candidato" }
      },
      required: ["iata"]
    }
  },
  {
    name: "shift_dates",
    description: "Altera as datas da viagem ou a duração em dias.",
    input_schema: {
      type: "object",
      properties: {
        dateStart: { type: "string", description: "Data de início em YYYY-MM-DD" },
        dateEnd: { type: "string", description: "Data de término em YYYY-MM-DD" },
        durationDays: { type: "number", description: "Duração em dias" }
      }
    }
  },
  {
    name: "set_budget",
    description: "Define ou atualiza o orçamento total em R$ (BRL).",
    input_schema: {
      type: "object",
      properties: {
        budgetTotal: { type: "number", description: "Valor do orçamento em reais" }
      },
      required: ["budgetTotal"]
    }
  },
  {
    name: "add_interest",
    description: "Adiciona uma nova tag de interesse/gosto ao perfil do usuário.",
    input_schema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Nome da tag de interesse (ex: 'gastronomia', 'praia')" }
      },
      required: ["tag"]
    }
  },
  {
    name: "remove_interest",
    description: "Remove uma tag de interesse do perfil do usuário.",
    input_schema: {
      type: "object",
      properties: {
        tag: { type: "string", description: "Nome da tag a remover" }
      },
      required: ["tag"]
    }
  },
  {
    name: "regenerate_day",
    description: "Enfileira a regeneração completa dos itens de um determinado dia do roteiro (preserva os itens marcados como 'pinned').",
    input_schema: {
      type: "object",
      properties: {
        dayIndex: { type: "number", description: "Índice do dia no roteiro (1-based)" }
      },
      required: ["dayIndex"]
    }
  },
  {
    name: "remove_item",
    description: "Remove um item específico do roteiro pelo id.",
    input_schema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "UUID do item do roteiro" }
      },
      required: ["itemId"]
    }
  },
  {
    name: "pin_item",
    description: "Fixa ou desfixa um item do roteiro para que ele não seja alterado durante a regeneração do dia.",
    input_schema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "UUID do item do roteiro" },
        pinned: { type: "boolean", description: "True para fixar, false para desafixar. Padrão: true" }
      },
      required: ["itemId"]
    }
  },
  {
    name: "find_hotel",
    description: "Busca opções de hotéis na região do destino.",
    input_schema: {
      type: "object",
      properties: {
        near: { type: "string", description: "Região ou referência de busca opcional" }
      }
    }
  },
  {
    name: "swap_restaurant",
    description: "Troca o restaurante de um item do tipo 'meal' por outro restaurante na mesma área.",
    input_schema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "UUID do item do roteiro a trocar" },
        cuisine: { type: "string", description: "Tipo de culinária (ex: 'italiana', 'sushi')" }
      },
      required: ["itemId"]
    }
  },
  {
    name: "search_flights",
    description: "Busca opções de voos para a viagem.",
    input_schema: {
      type: "object",
      properties: {}
    }
  }
];
