import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { DomainExceptionFilter } from "../common/domain-exception.filter";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, { provide: APP_FILTER, useClass: DomainExceptionFilter }]
})
export class ProfileModule {}
