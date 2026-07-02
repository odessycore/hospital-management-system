import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../database/master/entities/auth-user.entity';

export interface CreateLoginInput {
  email: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  tenantSlug: string | null;
}

/**
 * Manages the master-database login records (auth_users) that back tenant
 * profiles (doctors, patients, hospital admins). Keeps the central auth
 * registry in sync with per-tenant profile rows.
 */
@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(AuthUser)
    private readonly authUsers: Repository<AuthUser>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.authUsers.findOne({
      where: { email: this.normalizeEmail(email) },
    });
    if (existing) {
      throw new ConflictException(
        `An account with email "${email}" already exists.`,
      );
    }
  }

  /**
   * Creates a password-less login record. The account cannot sign in with a
   * password until it is set via an emailed invitation. `profileId` is linked
   * once the tenant profile row exists.
   */
  async createLogin(input: CreateLoginInput): Promise<AuthUser> {
    await this.assertEmailAvailable(input.email);
    const user = this.authUsers.create({
      email: this.normalizeEmail(input.email),
      fullName: input.fullName,
      passwordHash: null,
      role: input.role,
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
      profileId: null,
      isActive: true,
    });
    return this.authUsers.save(user);
  }

  /** Links a freshly-created tenant profile row back to its login record. */
  async linkProfile(authUserId: string, profileId: string): Promise<void> {
    await this.authUsers.update({ id: authUserId }, { profileId });
  }

  async updateLogin(
    authUserId: string,
    changes: Partial<Pick<AuthUser, 'email' | 'fullName' | 'isActive'>> & {
      password?: string;
    },
  ): Promise<void> {
    const user = await this.authUsers.findOne({ where: { id: authUserId } });
    if (!user) {
      throw new NotFoundException('Login record not found.');
    }
    if (changes.email && this.normalizeEmail(changes.email) !== user.email) {
      await this.assertEmailAvailable(changes.email);
      user.email = this.normalizeEmail(changes.email);
    }
    if (changes.fullName !== undefined) user.fullName = changes.fullName;
    if (changes.isActive !== undefined) user.isActive = changes.isActive;
    if (changes.password) {
      user.passwordHash = await bcrypt.hash(changes.password, 10);
    }
    await this.authUsers.save(user);
  }

  async deleteLogin(authUserId: string): Promise<void> {
    await this.authUsers.delete({ id: authUserId });
  }

  /** Delete every login record belonging to a tenant (used on tenant deletion). */
  async deleteAllForTenant(tenantId: string): Promise<void> {
    await this.authUsers.delete({ tenantId });
  }

  /** The first hospital administrator created for a tenant. */
  async findPrimaryAdmin(tenantId: string): Promise<AuthUser | null> {
    return this.authUsers.findOne({
      where: { tenantId, role: Role.HOSPITAL_ADMIN },
      order: { createdAt: 'ASC' },
    });
  }
}
