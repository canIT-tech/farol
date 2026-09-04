import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CurrentUser } from "@farol/shared";
import { JwtVerifier } from "./jwt-verifier";
import { IS_PUBLIC } from "./public.decorator";
import { UserUpsertService } from "./user-upsert.service";

const BEARER_PREFIX = "Bearer ";

interface AuthedRequest {
  headers: { authorization?: string };
  currentUser?: CurrentUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly verifier: JwtVerifier,
    private readonly userUpsert: UserUpsertService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Registrado como APP_GUARD: roda em toda rota. Só passa reto o que estiver
    // explicitamente marcado com @Public — no método ou no controller inteiro.
    const isPublic =
      this.reflector.get<boolean>(IS_PUBLIC, context.getHandler()) === true ||
      this.reflector.get<boolean>(IS_PUBLIC, context.getClass()) === true;
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException("token ausente");
    }
    const token = header.slice(BEARER_PREFIX.length);
    const { sub, email } = await this.verifier.verify(token);
    await this.userUpsert.ensure({ id: sub, email });
    req.currentUser = { id: sub, email };
    return true;
  }
}
