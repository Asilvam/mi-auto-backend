import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';

export type AuthenticatedRequest = Request & { user: { id: string; email: string; name: string; pictureUrl: string } };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [kind, token] = (request.headers.authorization ?? '').split(' ');
    if (kind !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.auth.validateAccessToken(payload.sub);
      request.user = { id: user._id.toString(), email: user.email, name: user.name, pictureUrl: user.pictureUrl };
      return true;
    } catch {
      throw new UnauthorizedException('La sesión venció. Inicia sesión nuevamente.');
    }
  }
}
