import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { GeoModule } from "../geo/geo.module";
import { FlightsController } from "./flights.controller";
import { RoutesController } from "./routes.controller";
import { FlightsService } from "./flights.service";

@Module({
  imports: [TripsModule, GeoModule],
  // RoutesController é a busca por rota livre: mesmas dependências, superfície
  // separada porque não pende de uma viagem (`/routes`, não `/trips/:id/...`).
  controllers: [FlightsController, RoutesController],
  providers: [FlightsService],
  // ChatToolService injeta este serviço nas tools do chat (Passo 7).
  exports: [FlightsService]
})
export class FlightsModule {}
