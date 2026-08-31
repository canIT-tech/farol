import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DbModule } from "../db/db.module";
import { TripsModule } from "../trips/trips.module";
import { ItineraryModule } from "../itinerary/itinerary.module";
import { ProfileModule } from "../profile/profile.module";
import { HotelsModule } from "../hotels/hotels.module";
import { FlightsModule } from "../flights/flights.module";
import { LlmModule } from "../llm/llm.module";
import { ChatController } from "./chat.controller";
import { ChatRepository } from "./chat.repository";
import { ChatService } from "./chat.service";
import { ChatToolService } from "./chat-tools.service";

@Module({
  imports: [
    DbModule,
    AuthModule,
    TripsModule,
    ItineraryModule,
    ProfileModule,
    HotelsModule,
    FlightsModule,
    LlmModule
  ],
  controllers: [ChatController],
  providers: [ChatRepository, ChatToolService, ChatService],
  exports: [ChatService]
})
export class ChatModule {}
