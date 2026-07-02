import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AccountsService } from '../accounts/accounts.service';
import { InvitationsService } from '../invitations/invitations.service';
import { Doctor } from '../database/tenant/entities/doctor.entity';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';

/**
 * Doctor CRUD scoped to the caller's tenant. Writes span two databases: the
 * doctor profile in the tenant DB and the login record in the master DB.
 */
@Injectable()
export class DoctorsService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly invitations: InvitationsService,
  ) {}

  private repo(ds: DataSource) {
    return ds.getRepository(Doctor);
  }

  list(ds: DataSource): Promise<Doctor[]> {
    return this.repo(ds).find({ order: { createdAt: 'DESC' } });
  }

  async get(ds: DataSource, id: string): Promise<Doctor> {
    const doctor = await this.repo(ds).findOne({ where: { id } });
    if (!doctor) {
      throw new NotFoundException('Doctor not found.');
    }
    return doctor;
  }

  async create(
    ds: DataSource,
    user: AuthenticatedUser,
    dto: CreateDoctorDto,
  ): Promise<Doctor> {
    // 1) master login record (password-less until the invite is completed)
    const login = await this.accounts.createLogin({
      email: dto.email,
      fullName: dto.fullName,
      role: Role.DOCTOR,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
    });

    // 2) tenant profile row (rolled back if it fails)
    try {
      const doctor = await this.repo(ds).save(
        this.repo(ds).create({
          authUserId: login.id,
          fullName: dto.fullName,
          email: dto.email.toLowerCase().trim(),
          phone: dto.phone ?? null,
          specialization: dto.specialization,
          licenseNumber: dto.licenseNumber ?? null,
          isActive: true,
        }),
      );
      await this.accounts.linkProfile(login.id, doctor.id);
      // 3) email the set-password invitation
      await this.invitations.sendInvite(login);
      return doctor;
    } catch (err) {
      await this.accounts.deleteLogin(login.id);
      throw err;
    }
  }

  /** Re-issues the set-password invitation email for an existing doctor. */
  async resendInvite(ds: DataSource, id: string): Promise<void> {
    const doctor = await this.get(ds, id);
    await this.invitations.sendInviteByAuthUserId(doctor.authUserId);
  }

  async update(
    ds: DataSource,
    id: string,
    dto: UpdateDoctorDto,
  ): Promise<Doctor> {
    const doctor = await this.get(ds, id);
    Object.assign(doctor, {
      fullName: dto.fullName ?? doctor.fullName,
      email: dto.email?.toLowerCase().trim() ?? doctor.email,
      phone: dto.phone ?? doctor.phone,
      specialization: dto.specialization ?? doctor.specialization,
      licenseNumber: dto.licenseNumber ?? doctor.licenseNumber,
      isActive: dto.isActive ?? doctor.isActive,
    });
    const saved = await this.repo(ds).save(doctor);

    await this.accounts.updateLogin(doctor.authUserId, {
      email: dto.email,
      fullName: dto.fullName,
      isActive: dto.isActive,
    });
    return saved;
  }

  async remove(ds: DataSource, id: string): Promise<void> {
    const doctor = await this.get(ds, id);
    await this.repo(ds).delete({ id }); // appointments cascade via FK
    await this.accounts.deleteLogin(doctor.authUserId);
  }
}
