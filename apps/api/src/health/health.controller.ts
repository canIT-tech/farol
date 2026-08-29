import { Controller, Get, HttpCode } from "@nestjs/common";
import type { HealthResponse } from "@farol/shared";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(200)
  async get(): Promise<HealthResponse> {
    return this.health.check();
  }
}
