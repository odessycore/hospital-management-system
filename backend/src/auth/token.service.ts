import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../common/interfaces/authenticated-user.interface';
import { AuthUser } from '../database/master/entities/auth-user.entity';
import { RefreshToken } from '../database/master/entities/refresh-token.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds (informational, for the client). */
  expiresIn: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private buildPayload(user: AuthUser): JwtPayload {
    return {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      profileId: user.profileId,
    };
  }

  /** Signs a short-lived JWT access token and mints a long-lived refresh token. */
  async issueTokenPair(user: AuthUser): Promise<TokenPair> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    const accessToken = await this.jwt.signAsync(this.buildPayload(user), {
      secret: jwtCfg.accessSecret,
      expiresIn: jwtCfg.accessTtl,
    });

    const rawRefresh = randomBytes(48).toString('hex');
    const expiresAt = new Date(
      Date.now() + jwtCfg.refreshTtlDays * 24 * 60 * 60 * 1000,
    );
    await this.refreshTokens.save(
      this.refreshTokens.create({
        authUserId: user.id,
        tokenHash: this.hash(rawRefresh),
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: this.accessTtlSeconds(jwtCfg.accessTtl),
    };
  }

  /**
   * Validates a raw refresh token, revokes it (rotation), and returns the owning
   * auth user so the caller can issue a fresh pair.
   */
  async consumeRefreshToken(rawToken: string): Promise<RefreshToken> {
    const record = await this.refreshTokens.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (
      !record ||
      record.revokedAt !== null ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
    record.revokedAt = new Date();
    await this.refreshTokens.save(record);
    return record;
  }

  /** Revoke a single refresh token (logout). Silently ignores unknown tokens. */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.refreshTokens.update(
      { tokenHash: this.hash(rawToken), revokedAt: null as unknown as Date },
      { revokedAt: new Date() },
    );
  }

  /** Revoke every active refresh token for a user. */
  async revokeAllForUser(authUserId: string): Promise<void> {
    await this.refreshTokens
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('authUserId = :authUserId AND revokedAt IS NULL', { authUserId })
      .execute();
  }

  private accessTtlSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 60;
    return value * unit;
  }

  toAuthenticatedUser(user: AuthUser): AuthenticatedUser {
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      profileId: user.profileId,
    };
  }
}
