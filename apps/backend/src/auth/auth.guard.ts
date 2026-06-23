import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { IS_SESSION_ONLY_KEY } from './session-only.decorator';

type AuthedRequest = Request & {
  cookies?: Record<string, string>;
  user?: string;
  authType?: 'session' | 'token';
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();

    // 1) API token via `Authorization: Bearer <token>`.
    const bearer = this.bearerToken(req);
    if (bearer) {
      const name = await this.auth.verifyApiToken(bearer);
      if (name) {
        req.user = name;
        req.authType = 'token';
      }
    }
    // 2) Fall back to the admin session cookie.
    if (!req.authType) {
      const username = await this.auth.verify(req.cookies?.[SESSION_COOKIE]);
      if (username) {
        req.user = username;
        req.authType = 'session';
      }
    }
    if (!req.authType) throw new UnauthorizedException();

    // 3) Session-only routes (token management, auth/security) are off-limits to API tokens.
    const sessionOnly = this.reflector.getAllAndOverride<boolean>(IS_SESSION_ONLY_KEY, targets);
    if (sessionOnly && req.authType === 'token') {
      throw new ForbiddenException('Admin session required');
    }
    return true;
  }

  private bearerToken(req: AuthedRequest): string | undefined {
    const header = req.headers?.authorization;
    const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
    return match?.[1]?.trim() || undefined;
  }
}
