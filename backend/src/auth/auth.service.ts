import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AuthUser } from '../database/master/entities/auth-user.entity';
import { Tenant } from '../database/master/entities/tenant.entity';
import { TokenPair, TokenService } from './token.service';

export interface GoogleProfile {
  email: string;
  googleId: string;
  fullName: string;
}

export interface AuthResult extends TokenPair {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    tenantId: string | null;
    tenantSlug: string | null;
    profileId: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthUser)
    private readonly authUsers: Repository<AuthUser>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    private readonly tokenService: TokenService,
  ) {}

  private toAuthResult(user: AuthUser, tokens: TokenPair): AuthResult {
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenantSlug,
        profileId: user.profileId,
      },
    };
  }

  /** Email + password login. No signup: unknown emails are rejected. */
  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<AuthResult> {
    const user = await this.authUsers.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const tokens = await this.tokenService.issueTokenPair(user);
    return this.toAuthResult(user, tokens);
  }

  /**
   * Google OAuth login. The account MUST already exist (no signup). On first
   * Google login for a known email we bind the googleId to the account.
   */
  async loginWithGoogle(profile: GoogleProfile): Promise<AuthResult> {
    const user = await this.authUsers.findOne({
      where: { email: profile.email.toLowerCase().trim() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'No account is registered for this Google email. Contact your administrator.',
      );
    }
    if (!user.googleId) {
      user.googleId = profile.googleId;
      await this.authUsers.save(user);
    }
    const tokens = await this.tokenService.issueTokenPair(user);
    return this.toAuthResult(user, tokens);
  }

  /** Rotate a refresh token and issue a new pair. */
  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const consumed =
      await this.tokenService.consumeRefreshToken(rawRefreshToken);
    const user = await this.authUsers.findOne({
      where: { id: consumed.authUserId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active.');
    }
    const tokens = await this.tokenService.issueTokenPair(user);
    return this.toAuthResult(user, tokens);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.tokenService.revokeRefreshToken(rawRefreshToken);
  }

  async getProfile(userId: string) {
    const user = await this.authUsers.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Account not found.');
    }
    let tenantName: string | null = null;
    if (user.tenantId) {
      const tenant = await this.tenants.findOne({
        where: { id: user.tenantId },
      });
      tenantName = tenant?.name ?? null;
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      tenantName,
      profileId: user.profileId,
    };
  }
}
