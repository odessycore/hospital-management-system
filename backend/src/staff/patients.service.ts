import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AccountsService } from '../accounts/accounts.service';
import { InvitationsService } from '../invitations/invitations.service';
import { Patient } from '../database/tenant/entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';

/** Patient CRUD scoped to the caller's tenant (tenant DB + master login). */
@Injectable()
export class PatientsService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly invitations: InvitationsService,
  ) {}

  private repo(ds: DataSource) {
    return ds.getRepository(Patient);
  }

  list(ds: DataSource): Promise<Patient[]> {
    return this.repo(ds).find({ order: { createdAt: 'DESC' } });
  }

  async get(ds: DataSource, id: string): Promise<Patient> {
    const patient = await this.repo(ds).findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Patient not found.');
    }
    return patient;
  }

  async create(
    ds: DataSource,
    user: AuthenticatedUser,
    dto: CreatePatientDto,
  ): Promise<Patient> {
    const login = await this.accounts.createLogin({
      email: dto.email,
      fullName: dto.fullName,
      role: Role.PATIENT,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
    });

    try {
      const patient = await this.repo(ds).save(
        this.repo(ds).create({
          authUserId: login.id,
          fullName: dto.fullName,
          email: dto.email.toLowerCase().trim(),
          phone: dto.phone ?? null,
          dateOfBirth: dto.dateOfBirth ?? null,
          gender: dto.gender ?? null,
          bloodGroup: dto.bloodGroup ?? null,
          address: dto.address ?? null,
          isActive: true,
        }),
      );
      await this.accounts.linkProfile(login.id, patient.id);
      await this.invitations.sendInvite(login);
      return patient;
    } catch (err) {
      await this.accounts.deleteLogin(login.id);
      throw err;
    }
  }

  /** Re-issues the set-password invitation email for an existing patient. */
  async resendInvite(ds: DataSource, id: string): Promise<void> {
    const patient = await this.get(ds, id);
    await this.invitations.sendInviteByAuthUserId(patient.authUserId);
  }

  async update(
    ds: DataSource,
    id: string,
    dto: UpdatePatientDto,
  ): Promise<Patient> {
    const patient = await this.get(ds, id);
    Object.assign(patient, {
      fullName: dto.fullName ?? patient.fullName,
      email: dto.email?.toLowerCase().trim() ?? patient.email,
      phone: dto.phone ?? patient.phone,
      dateOfBirth: dto.dateOfBirth ?? patient.dateOfBirth,
      gender: dto.gender ?? patient.gender,
      bloodGroup: dto.bloodGroup ?? patient.bloodGroup,
      address: dto.address ?? patient.address,
      isActive: dto.isActive ?? patient.isActive,
    });
    const saved = await this.repo(ds).save(patient);

    await this.accounts.updateLogin(patient.authUserId, {
      email: dto.email,
      fullName: dto.fullName,
      isActive: dto.isActive,
    });
    return saved;
  }

  async remove(ds: DataSource, id: string): Promise<void> {
    const patient = await this.get(ds, id);
    await this.repo(ds).delete({ id });
    await this.accounts.deleteLogin(patient.authUserId);
  }
}
