import { Module } from "@nestjs/common";
import { PlacesService } from "./places.service";

// Sem controller: o Places só é consumido por dentro (enrich do roteiro,
// swap_restaurant e, no Passo 7, as tools do chat).
@Module({
  providers: [PlacesService],
  exports: [PlacesService]
})
export class PlacesModule {}
