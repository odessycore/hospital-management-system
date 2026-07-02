import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** A doctor within a single hospital (per-tenant database). */
@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Mirror of auth_users.id in the master DB for this doctor's login. */
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  authUserId: string;

  @Column({ length: 200 })
  fullName: string;

  @Index({ unique: true })
  @Column({ length: 200 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ length: 150 })
  specialization: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  licenseNumber: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
