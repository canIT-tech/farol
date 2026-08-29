import { Module } from "@nestjs/common";
import { ProfileModule } from "../profile/profile.module";
import { TripsModule } from "../trips/trips.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";
import { CatalogRepository } from "./catalog.repository";

@Module({
  imports: [TripsModule, ProfileModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, CatalogRepository]
})
export class DiscoveryModule {}
