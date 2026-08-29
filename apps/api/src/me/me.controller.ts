import { Controller, Get, UseGuards } from "@nestjs/common";
import type { CurrentUser as CurrentUserType } from "@farol/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("me")
export class MeController {
  @Get()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: CurrentUserType): CurrentUserType {
    return user;
  }
}
