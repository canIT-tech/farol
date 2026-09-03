import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { GeoModule } from "../geo/geo.module";
import { FlightsController } from "./flights.controller";
import { FlightsService } from "./flights.service";

@Module({
  imports: [TripsModule, GeoModule],
  controllers: [FlightsController],
  providers: [FlightsService],
  // ChatToolService injeta este serviço nas tools do chat (Passo 7).
  exports: [FlightsService]
})
export class FlightsModule {}
