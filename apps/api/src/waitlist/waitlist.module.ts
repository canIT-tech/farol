import { Module } from "@nestjs/common";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistRepository } from "./waitlist.repository";
import { WaitlistService } from "./waitlist.service";

@Module({
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistRepository],
  exports: [WaitlistService]
})
export class WaitlistModule {}
