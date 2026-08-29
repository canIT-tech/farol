import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { CurrentUser as CurrentUserType } from "@farol/shared";

// Lê o usuário que o AuthGuard colocou em request.currentUser.
export function currentUserFromContext(_data: unknown, ctx: ExecutionContext): CurrentUserType {
  return ctx.switchToHttp().getRequest<{ currentUser: CurrentUserType }>().currentUser;
}

export const CurrentUser = createParamDecorator(currentUserFromContext);
