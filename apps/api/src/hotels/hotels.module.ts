import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { HotelsController } from "./hotels.controller";
import { HotelsService } from "./hotels.service";

@Module({
  imports: [TripsModule],
  controllers: [HotelsController],
  providers: [HotelsService],
  // ChatToolService injeta este serviço nas tools do chat (Passo 7).
  exports: [HotelsService]
})
export class HotelsModule {}
