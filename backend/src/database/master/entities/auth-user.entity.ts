import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum';

/**
 * Central authentication registry (master database). Holds ONLY the data
 * required to authenticate and route a login to the right tenant. Clinical /
 * profile data lives in the per-tenant database, referenced by `profileId`.
 */
@Entity('auth_users')
@Index(['email'], { unique: true })
export class AuthUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  email: string;

  @Column({ length: 200 })
  fullName: string;

  /** bcrypt hash. Null for accounts that only sign in with Google. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  passwordHash: string | null;

  /** Google account subject id, set on first Google login. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  googleId: string | null;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  /** Null for SUPER_ADMIN. */
  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  /** Denormalised tenant slug so requests can resolve the tenant DB without a lookup. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  tenantSlug: string | null;

  /** doctors.id / patients.id inside the tenant DB (DOCTOR / PATIENT). */
  @Column({ type: 'uuid', nullable: true })
  profileId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
