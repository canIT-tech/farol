import { Controller, Get, HttpCode } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import type { HealthResponse } from "@farol/shared";
import { HealthService } from "./health.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(200)
  async get(): Promise<HealthResponse> {
    return this.health.check();
  }
}
