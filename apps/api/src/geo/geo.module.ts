import { Module } from "@nestjs/common";
import { GeoController } from "./geo.controller";
import { GeoService } from "./geo.service";

@Module({
  controllers: [GeoController],
  providers: [GeoService],
  // O chat usa o GeoService para traduzir código de companhia e de aeroporto.
  exports: [GeoService]
})
export class GeoModule {}
