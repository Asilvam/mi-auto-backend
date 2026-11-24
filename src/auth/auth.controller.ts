import { Body, Controller, Get, Headers, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly secure: boolean;
  private readonly refreshCookie = 'mi_auto_refresh';
  private readonly csrfCookie = 'mi_auto_csrf';
  private readonly allowedOrigins: string[];

  constructor(private readonly auth: AuthService, config: ConfigService) {
    this.secure = config.get('NODE_ENV') === 'production';
    this.allowedOrigins = (config.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:5173').split(',').map((x) => x.trim());
  }

  @Get('csrf')
  csrf(@Res({ passthrough: true }) response: Response) {
    const csrfToken = this.auth.newCsrfToken();
    response.cookie(this.csrfCookie, csrfToken, { httpOnly: false, secure: this.secure, sameSite: 'strict', path: '/api/auth' });
    return { csrfToken };
  }

  @Post('google')
  async google(@Body() body: GoogleLoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.loginWithGoogle(body.credential);
    this.setRefreshCookie(response, result.refreshToken, result.expiresAt);
    const csrfToken = this.auth.newCsrfToken();
    response.cookie(this.csrfCookie, csrfToken, { httpOnly: false, secure: this.secure, sameSite: 'strict', path: '/api/auth' });
    return { accessToken: result.accessToken, expiresAt: result.expiresAt, user: result.user };
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Headers('origin') origin: string, @Headers('x-csrf-token') csrfHeader: string, @Res({ passthrough: true }) response: Response) {
    this.validateCookieRequest(request, origin, csrfHeader);
    const result = await this.auth.refresh(request.cookies?.[this.refreshCookie]);
    this.setRefreshCookie(response, result.refreshToken, result.expiresAt);
    return { accessToken: result.accessToken, expiresAt: result.expiresAt, user: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedRequest['user']) { return user; }

  @Post('logout')
  async logout(@Req() request: Request, @Headers('origin') origin: string, @Headers('x-csrf-token') csrfHeader: string, @Res({ passthrough: true }) response: Response) {
    this.validateCookieRequest(request, origin, csrfHeader);
    await this.auth.logout(request.cookies?.[this.refreshCookie]);
    response.clearCookie(this.refreshCookie, { httpOnly: true, secure: this.secure, sameSite: 'lax', path: '/api/auth' });
    response.clearCookie(this.csrfCookie, { secure: this.secure, sameSite: 'strict', path: '/api/auth' });
    return { ok: true };
  }

  private setRefreshCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(this.refreshCookie, token, { httpOnly: true, secure: this.secure, sameSite: 'lax', path: '/api/auth', expires: expiresAt });
  }

  private validateCookieRequest(request: Request, origin?: string, csrfHeader?: string) {
    if (!origin || !this.allowedOrigins.includes(origin)) throw new UnauthorizedException('Origen no autorizado.');
    if (!this.auth.validCsrf(request.cookies?.[this.csrfCookie], csrfHeader)) throw new UnauthorizedException('Validación CSRF fallida.');
  }
}
