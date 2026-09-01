import { Injectable } from "@nestjs/common";
import { TripsService } from "../trips/trips.service";
import { ItineraryService } from "../itinerary/itinerary.service";
import { ProfileService } from "../profile/profile.service";
import { HotelsService } from "../hotels/hotels.service";
import { FlightsService } from "../flights/flights.service";
import { CHAT_TOOLS, type ChatToolDefinition } from "./chat-tools.types";

export interface ToolCallExecution {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

@Injectable()
export class ChatToolService {
  constructor(
    private readonly trips: TripsService,
    private readonly itinerary: ItineraryService,
    private readonly profile: ProfileService,
    private readonly hotels: HotelsService,
    private readonly flights: FlightsService
  ) {}

  getToolDefinitions(): ChatToolDefinition[] {
    return CHAT_TOOLS;
  }

  async executeTool(
    userId: string,
    tripId: string,
    toolCall: ToolCallExecution
  ): Promise<ToolExecutionResult> {
    try {
      switch (toolCall.name) {
        case "set_destination": {
          const iata = String(toolCall.args.iata);
          const result = await this.itinerary.chooseDestination(userId, tripId, iata);
          return { success: true, data: result };
        }
        case "shift_dates": {
          const { dateStart, dateEnd, durationDays } = toolCall.args;
          await this.trips.updateDates(userId, tripId, {
            dateStart: dateStart ? String(dateStart) : undefined,
            dateEnd: dateEnd ? String(dateEnd) : undefined,
            durationDays: durationDays !== undefined ? Number(durationDays) : undefined
          });
          return { success: true, data: { updated: true } };
        }
        case "set_budget": {
          const budgetTotal = Number(toolCall.args.budgetTotal);
          await this.trips.updateBudget(userId, tripId, budgetTotal);
          return { success: true, data: { updated: true } };
        }
        case "add_interest": {
          const tag = String(toolCall.args.tag);
          const result = await this.profile.addInterest(userId, tag);
          return { success: true, data: result };
        }
        case "remove_interest": {
          const tag = String(toolCall.args.tag);
          const result = await this.profile.removeInterest(userId, tag);
          return { success: true, data: result };
        }
        case "regenerate_day": {
          const dayIndex = Number(toolCall.args.dayIndex);
          await this.itinerary.regenerateDay(userId, tripId, dayIndex);
          return { success: true, data: { queued: true } };
        }
        case "remove_item": {
          const itemId = String(toolCall.args.itemId);
          await this.itinerary.removeItem(userId, tripId, itemId);
          return { success: true, data: { removed: true } };
        }
        case "pin_item": {
          const itemId = String(toolCall.args.itemId);
          const pinned = toolCall.args.pinned === undefined ? true : Boolean(toolCall.args.pinned);
          await this.itinerary.pinItem(userId, tripId, itemId, pinned);
          return { success: true, data: { pinned } };
        }
        case "find_hotel": {
          const result = await this.hotels.search(userId, tripId);
          return { success: true, data: result };
        }
        case "swap_restaurant": {
          const itemId = String(toolCall.args.itemId);
          const cuisine = toolCall.args.cuisine ? String(toolCall.args.cuisine) : undefined;
          const result = await this.itinerary.swapRestaurant(userId, tripId, itemId, { cuisine });
          return { success: true, data: result };
        }
        case "search_flights": {
          const result = await this.flights.search(userId, tripId);
          return { success: true, data: result };
        }
        default:
          return { success: false, error: `Ferramenta desconhecida: ${toolCall.name}` };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
