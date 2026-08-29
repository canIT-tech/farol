import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CurrentUser } from "@farol/shared";
import { JwtVerifier } from "./jwt-verifier";
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
    private readonly userUpsert: UserUpsertService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
