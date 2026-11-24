import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { Session, SessionDocument } from './schemas/session.schema';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;
  private readonly googleClientId?: string;
  private readonly refreshTtlDays: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    @InjectModel(Session.name) private readonly sessions: Model<SessionDocument>,
  ) {
    this.googleClientId = config.get<string>('GOOGLE_CLIENT_ID') || undefined;
    this.googleClient = new OAuth2Client(this.googleClientId);
    this.refreshTtlDays = Number(config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'));
  }

  async loginWithGoogle(credential: string) {
    if (!this.googleClientId) throw new ServiceUnavailableException('Configura GOOGLE_CLIENT_ID para activar Google Sign-In.');
    const ticket = await this.googleClient.verifyIdToken({
      idToken: credential,
      audience: this.googleClientId,
    }).catch(() => { throw new UnauthorizedException('No se pudo validar la cuenta de Google.'); });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      throw new UnauthorizedException('Google no entregó un correo verificado.');
    }
    const user = await this.users.findOrCreateGoogleUser({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = this.refreshExpiry();
    await this.sessions.create({ userId: user._id, refreshTokenHash: this.hash(refreshToken), expiresAt });
    return { accessToken: await this.accessToken(user._id), refreshToken, expiresAt, user: this.publicUser(user) };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('Sesión vencida. Inicia sesión nuevamente.');
    const oldHash = this.hash(refreshToken);
    const session = await this.sessions.findOne({ refreshTokenHash: oldHash, revokedAt: null, expiresAt: { $gt: new Date() } }).select('+refreshTokenHash').exec();
    if (!session) throw new UnauthorizedException('Sesión vencida. Inicia sesión nuevamente.');

    const nextToken = randomBytes(48).toString('base64url');
    const nextExpiry = this.refreshExpiry();
    const rotated = await this.sessions.findOneAndUpdate(
      { _id: session._id, refreshTokenHash: oldHash, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { refreshTokenHash: this.hash(nextToken), expiresAt: nextExpiry } },
      { new: true },
    ).exec();
    if (!rotated) throw new UnauthorizedException('La sesión ya fue renovada o revocada.');
    const user = await this.users.findById(session.userId.toString());
    if (!user) throw new UnauthorizedException('La cuenta asociada a esta sesión ya no existe.');
    return { accessToken: await this.accessToken(session.userId), refreshToken: nextToken, expiresAt: nextExpiry, user };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await this.sessions.updateOne({ refreshTokenHash: this.hash(refreshToken), revokedAt: null }, { $set: { revokedAt: new Date() } }).exec();
  }

  async validateAccessToken(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new UnauthorizedException();
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  newCsrfToken() { return randomBytes(32).toString('base64url'); }

  validCsrf(cookieToken?: string, headerToken?: string) {
    if (!cookieToken || !headerToken) return false;
    const a = Buffer.from(cookieToken);
    const b = Buffer.from(headerToken);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async accessToken(userId: Types.ObjectId) {
    return this.jwt.signAsync({ sub: userId.toString() });
  }
  private refreshExpiry() { return new Date(Date.now() + this.refreshTtlDays * 86400000); }
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private publicUser(user: { _id: Types.ObjectId; email: string; name: string; pictureUrl: string }) {
    return { id: user._id.toString(), email: user.email, name: user.name, pictureUrl: user.pictureUrl };
  }
}
