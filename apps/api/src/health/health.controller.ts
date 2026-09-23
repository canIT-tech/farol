import { Controller, Get, Res } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import type { HealthResponse } from "@farol/shared";
import { HealthService } from "./health.service";

type StatusSetter = { status(code: number): unknown };

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // 503 quando uma dependência cai: o health check do Render tira a instância
  // do tráfego em vez de servir uma api que responde 200 sem banco.
  @Get()
  async get(@Res({ passthrough: true }) res: StatusSetter): Promise<HealthResponse> {
    const body = await this.health.check();
    res.status(body.status === "ok" ? 200 : 503);
    return body;
  }
}
