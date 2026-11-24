import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';

jest.mock('@nestjs/jwt', () => ({ JwtService: class JwtService {} }));

describe('AuthService Google sign-in', () => {
  const user = { _id: new Types.ObjectId(), email: 'driver@example.com', name: 'Driver', pictureUrl: '' };
  let jwt: { signAsync: jest.Mock };
  let config: { get: jest.Mock };
  let users: { findOrCreateGoogleUser: jest.Mock };
  let sessions: { create: jest.Mock };

  beforeEach(() => {
    jwt = { signAsync: jest.fn().mockResolvedValue('access-jwt') };
    config = { get: jest.fn((key: string, fallback?: string) => key === 'GOOGLE_CLIENT_ID' ? 'web-client-id' : fallback) };
    users = { findOrCreateGoogleUser: jest.fn().mockResolvedValue(user) };
    sessions = { create: jest.fn().mockResolvedValue({}) };
  });

  afterEach(() => jest.restoreAllMocks());

  it('creates a user session only after Google returns a verified email', async () => {
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(async () => ({
      getPayload: () => ({ sub: 'google-subject', email: user.email, email_verified: true, name: user.name }),
    }) as never);
    const service = new AuthService(jwt as never, config as never, users as never, sessions as never);

    const result = await service.loginWithGoogle('google-id-token');

    expect(users.findOrCreateGoogleUser).toHaveBeenCalledWith(expect.objectContaining({ sub: 'google-subject', email: user.email }));
    expect(sessions.create).toHaveBeenCalledWith(expect.objectContaining({ userId: user._id, refreshTokenHash: expect.any(String) }));
    expect(result).toMatchObject({ accessToken: 'access-jwt', user: { id: user._id.toString(), email: user.email } });
    expect(result.refreshToken).not.toBe('access-jwt');
  });

  it('rejects an invalid Google credential', async () => {
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(() => Promise.reject(new Error('invalid token')) as never);
    const service = new AuthService(jwt as never, config as never, users as never, sessions as never);
    await expect(service.loginWithGoogle('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('reports an explicit configuration error when the OAuth client ID is absent', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => key === 'GOOGLE_CLIENT_ID' ? '' : fallback);
    const service = new AuthService(jwt as never, config as never, users as never, sessions as never);
    await expect(service.loginWithGoogle('token')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
