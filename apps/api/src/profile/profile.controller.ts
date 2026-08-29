import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  tasteProfileInputSchema,
  type CurrentUser as CurrentUserType,
  type TasteProfile,
  type TasteProfileInput
} from "@farol/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ProfileService } from "./profile.service";

@Controller("me/profile")
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: CurrentUserType): Promise<TasteProfile> {
    return this.profile.get(user.id);
  }

  @Put()
  put(
    @CurrentUser() user: CurrentUserType,
    @Body(new ZodValidationPipe(tasteProfileInputSchema)) body: TasteProfileInput
  ): Promise<TasteProfile> {
    return this.profile.upsert(user.id, body);
  }
}
