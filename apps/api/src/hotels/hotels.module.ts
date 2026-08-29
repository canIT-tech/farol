import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { HotelsController } from "./hotels.controller";
import { HotelsService } from "./hotels.service";

@Module({
  imports: [TripsModule],
  controllers: [HotelsController],
  providers: [HotelsService]
})
export class HotelsModule {}
