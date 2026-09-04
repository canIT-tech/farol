import { Controller, Get } from "@nestjs/common";
import type { CurrentUser as CurrentUserType } from "@farol/shared";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("me")
export class MeController {
  @Get()
  me(@CurrentUser() user: CurrentUserType): CurrentUserType {
    return user;
  }
}
