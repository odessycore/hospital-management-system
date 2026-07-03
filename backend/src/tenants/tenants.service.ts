import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { AccountsService } from '../accounts/accounts.service';
import { InvitationsService } from '../invitations/invitations.service';
import { Tenant } from '../database/master/entities/tenant.entity';
import { Appointment } from '../database/tenant/entities/appointment.entity';
import { Doctor } from '../database/tenant/entities/doctor.entity';
import { Patient } from '../database/tenant/entities/patient.entity';
import { TenantConnectionService } from '../database/tenant/tenant-connection.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    private readonly connections: TenantConnectionService,
    private readonly accounts: AccountsService,
    private readonly invitations: InvitationsService,
  ) {}

  async list(): Promise<Tenant[]> {
    return this.tenants.find({ order: { createdAt: 'DESC' } });
  }

  async getById(id: string): Promise<Tenant> {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Hospital not found.');
    }
    return tenant;
  }

  /**
   * Creates a tenant: persists the master row, provisions its dedicated
   * database, and creates the initial hospital administrator login.
   */
  async create(dto: CreateTenantDto): Promise<Tenant> {
    const slugTaken = await this.tenants.findOne({ where: { slug: dto.slug } });
    if (slugTaken) {
      throw new ConflictException(`Slug "${dto.slug}" is already in use.`);
    }
    await this.accounts.assertEmailAvailable(dto.adminEmail);

    const tenant = await this.tenants.save(
      this.tenants.create({
        name: dto.name,
        slug: dto.slug,
        address: dto.address ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        isActive: true,
      }),
    );

    try {
      await this.connections.provisionDatabase(tenant.slug);
      const admin = await this.accounts.createLogin({
        email: dto.adminEmail,
        fullName: dto.adminFullName,
        role: Role.HOSPITAL_ADMIN,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      });
      // Email the administrator an invitation to set their password.
      await this.invitations.sendInvite(admin);
    } catch (err) {
      // Roll back the master row if provisioning/admin creation failed.
      this.logger.error(
        `Failed to provision tenant "${tenant.slug}", rolling back.`,
        err as Error,
      );
      await this.tenants.delete({ id: tenant.id });
      await this.connections.dropDatabase(tenant.slug).catch(() => undefined);
      throw err;
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.getById(id);
    Object.assign(tenant, {
      name: dto.name ?? tenant.name,
      address: dto.address ?? tenant.address,
      phone: dto.phone ?? tenant.phone,
      email: dto.email ?? tenant.email,
      isActive: dto.isActive ?? tenant.isActive,
    });
    return this.tenants.save(tenant);
  }

  /** Re-issues the set-password invitation for a tenant's hospital administrator. */
  async resendAdminInvite(id: string): Promise<void> {
    const tenant = await this.getById(id);
    const admin = await this.accounts.findPrimaryAdmin(tenant.id);
    if (!admin) {
      throw new NotFoundException(
        'No hospital administrator found for this hospital.',
      );
    }
    await this.invitations.sendInvite(admin);
  }

  /** Deletes a tenant: drops its database and removes all its login records. */
  async remove(id: string): Promise<void> {
    const tenant = await this.getById(id);
    await this.accounts.deleteAllForTenant(tenant.id);
    await this.connections.dropDatabase(tenant.slug);
    await this.tenants.delete({ id: tenant.id });
  }

  /** Aggregate counts + doctor/patient listings for a single tenant. */
  async getStats(id: string) {
    const tenant = await this.getById(id);
    const ds = await this.connections.getConnection(tenant.slug);
    const doctorRepo = ds.getRepository(Doctor);
    const patientRepo = ds.getRepository(Patient);
    const appointmentRepo = ds.getRepository(Appointment);

    const [doctors, patients, doctorCount, patientCount, appointmentCount] =
      await Promise.all([
        doctorRepo.find({ order: { createdAt: 'DESC' } }),
        patientRepo.find({ order: { createdAt: 'DESC' } }),
        doctorRepo.count(),
        patientRepo.count(),
        appointmentRepo.count(),
      ]);

    return {
      tenant,
      counts: { doctorCount, patientCount, appointmentCount },
      doctors,
      patients,
    };
  }

  /** Lightweight counts for every tenant (super-admin overview cards). */
  async listWithCounts() {
    const tenants = await this.list();
    return Promise.all(
      tenants.map(async (tenant) => {
        try {
          const ds = await this.connections.getConnection(tenant.slug);
          const [doctorCount, patientCount, appointmentCount] =
            await Promise.all([
              ds.getRepository(Doctor).count(),
              ds.getRepository(Patient).count(),
              ds.getRepository(Appointment).count(),
            ]);
          return { ...tenant, doctorCount, patientCount, appointmentCount };
        } catch {
          return {
            ...tenant,
            doctorCount: 0,
            patientCount: 0,
            appointmentCount: 0,
          };
        }
      }),
    );
  }
}
