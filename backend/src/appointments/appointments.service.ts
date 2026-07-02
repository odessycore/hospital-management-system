import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { Appointment } from '../database/tenant/entities/appointment.entity';
import { Doctor } from '../database/tenant/entities/doctor.entity';
import { Patient } from '../database/tenant/entities/patient.entity';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

export type AppointmentView = 'upcoming' | 'history' | 'all';

/** Flattened, client-friendly appointment shape. */
export interface AppointmentDto {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  reason: string;
  notes: string | null;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  patientId: string;
  patientName: string;
  createdAt: Date;
}

@Injectable()
export class AppointmentsService {
  private repo(ds: DataSource) {
    return ds.getRepository(Appointment);
  }

  private toDto(a: Appointment): AppointmentDto {
    return {
      id: a.id,
      scheduledAt: a.scheduledAt,
      durationMinutes: a.durationMinutes,
      status: a.status,
      reason: a.reason,
      notes: a.notes,
      doctorId: a.doctorId,
      doctorName: a.doctor?.fullName ?? 'Unknown',
      doctorSpecialization: a.doctor?.specialization ?? '',
      patientId: a.patientId,
      patientName: a.patient?.fullName ?? 'Unknown',
      createdAt: a.createdAt,
    };
  }

  /**
   * Returns appointments visible to the caller:
   *  - HOSPITAL_ADMIN: every appointment in the tenant
   *  - DOCTOR: only their own appointments
   *  - PATIENT: only their own appointments
   */
  async listForUser(
    ds: DataSource,
    user: AuthenticatedUser,
    view: AppointmentView,
  ): Promise<AppointmentDto[]> {
    const qb = this.repo(ds)
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .leftJoinAndSelect('a.patient', 'patient');

    if (user.role === Role.DOCTOR) {
      qb.andWhere('a.doctorId = :pid', { pid: user.profileId });
    } else if (user.role === Role.PATIENT) {
      qb.andWhere('a.patientId = :pid', { pid: user.profileId });
    }

    const now = new Date();
    if (view === 'upcoming') {
      qb.andWhere('a.scheduledAt >= :now', { now }).andWhere(
        'a.status = :s',
        { s: AppointmentStatus.SCHEDULED },
      );
      qb.orderBy('a.scheduledAt', 'ASC');
    } else if (view === 'history') {
      qb.andWhere('(a.scheduledAt < :now OR a.status != :s)', {
        now,
        s: AppointmentStatus.SCHEDULED,
      });
      qb.orderBy('a.scheduledAt', 'DESC');
    } else {
      qb.orderBy('a.scheduledAt', 'DESC');
    }

    const rows = await qb.getMany();
    return rows.map((r) => this.toDto(r));
  }

  async get(ds: DataSource, id: string): Promise<AppointmentDto> {
    const appointment = await this.repo(ds).findOne({
      where: { id },
      relations: { doctor: true, patient: true },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }
    return this.toDto(appointment);
  }

  private async assertParticipants(
    ds: DataSource,
    doctorId: string,
    patientId: string,
  ): Promise<void> {
    const doctor = await ds
      .getRepository(Doctor)
      .findOne({ where: { id: doctorId } });
    if (!doctor) throw new BadRequestException('Selected doctor does not exist.');
    const patient = await ds
      .getRepository(Patient)
      .findOne({ where: { id: patientId } });
    if (!patient)
      throw new BadRequestException('Selected patient does not exist.');
  }

  private assertNotInPast(start: Date): void {
    if (start.getTime() < Date.now()) {
      throw new BadRequestException(
        'Appointments cannot be scheduled in the past.',
      );
    }
  }

  /** Formats a stored UTC timestamp for conflict messages, e.g. "2026-08-15 09:00". */
  private formatSlot(date: Date): string {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  /**
   * Rejects appointments that overlap an existing one for the same doctor OR the
   * same patient. Slots are half-open [start, start + duration): back-to-back
   * appointments (one ending exactly when the next begins) do NOT conflict.
   * Cancelled and no-show appointments free their slot and are ignored.
   */
  private async assertNoConflicts(
    ds: DataSource,
    params: {
      doctorId: string;
      patientId: string;
      start: Date;
      durationMinutes: number;
      excludeId?: string;
    },
  ): Promise<void> {
    const end = new Date(params.start.getTime() + params.durationMinutes * 60000);

    const findClash = (column: 'doctorId' | 'patientId', id: string) => {
      const qb = this.repo(ds)
        .createQueryBuilder('a')
        .where(`a.${column} = :id`, { id })
        .andWhere('a.status NOT IN (:...inactive)', {
          inactive: [
            AppointmentStatus.CANCELLED,
            AppointmentStatus.NO_SHOW,
          ],
        })
        // existing.start < new.end AND existing.end > new.start
        .andWhere('a."scheduledAt" < :end', { end })
        .andWhere(
          `a."scheduledAt" + make_interval(mins => a."durationMinutes") > :start`,
          { start: params.start },
        );
      if (params.excludeId) {
        qb.andWhere('a.id != :excludeId', { excludeId: params.excludeId });
      }
      return qb.orderBy('a."scheduledAt"', 'ASC').getOne();
    };

    const doctorClash = await findClash('doctorId', params.doctorId);
    if (doctorClash) {
      const clashEnd = new Date(
        doctorClash.scheduledAt.getTime() +
          doctorClash.durationMinutes * 60000,
      );
      throw new ConflictException(
        `This doctor already has an appointment from ${this.formatSlot(
          doctorClash.scheduledAt,
        )} to ${this.formatSlot(clashEnd)} (UTC). Please choose another time.`,
      );
    }

    const patientClash = await findClash('patientId', params.patientId);
    if (patientClash) {
      const clashEnd = new Date(
        patientClash.scheduledAt.getTime() +
          patientClash.durationMinutes * 60000,
      );
      throw new ConflictException(
        `This patient already has an appointment from ${this.formatSlot(
          patientClash.scheduledAt,
        )} to ${this.formatSlot(clashEnd)} (UTC). Please choose another time.`,
      );
    }
  }

  async create(
    ds: DataSource,
    dto: CreateAppointmentDto,
  ): Promise<AppointmentDto> {
    await this.assertParticipants(ds, dto.doctorId, dto.patientId);
    const start = new Date(dto.scheduledAt);
    const durationMinutes = dto.durationMinutes ?? 30;
    this.assertNotInPast(start);
    await this.assertNoConflicts(ds, {
      doctorId: dto.doctorId,
      patientId: dto.patientId,
      start,
      durationMinutes,
    });
    const saved = await this.repo(ds).save(
      this.repo(ds).create({
        doctorId: dto.doctorId,
        patientId: dto.patientId,
        scheduledAt: start,
        durationMinutes,
        reason: dto.reason,
        notes: dto.notes ?? null,
        status: AppointmentStatus.SCHEDULED,
      }),
    );
    return this.get(ds, saved.id);
  }

  async update(
    ds: DataSource,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentDto> {
    const appointment = await this.repo(ds).findOne({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }
    if (dto.doctorId || dto.patientId) {
      await this.assertParticipants(
        ds,
        dto.doctorId ?? appointment.doctorId,
        dto.patientId ?? appointment.patientId,
      );
    }

    const nextDoctorId = dto.doctorId ?? appointment.doctorId;
    const nextPatientId = dto.patientId ?? appointment.patientId;
    const nextStart = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : appointment.scheduledAt;
    const nextDuration = dto.durationMinutes ?? appointment.durationMinutes;
    const nextStatus = dto.status ?? appointment.status;

    // Only guard time/overlap for appointments that remain actively scheduled;
    // completing/cancelling historical records must not be blocked.
    if (nextStatus === AppointmentStatus.SCHEDULED) {
      if (dto.scheduledAt || dto.durationMinutes) {
        this.assertNotInPast(nextStart);
      }
      await this.assertNoConflicts(ds, {
        doctorId: nextDoctorId,
        patientId: nextPatientId,
        start: nextStart,
        durationMinutes: nextDuration,
        excludeId: appointment.id,
      });
    }

    Object.assign(appointment, {
      doctorId: nextDoctorId,
      patientId: nextPatientId,
      scheduledAt: nextStart,
      durationMinutes: nextDuration,
      status: nextStatus,
      reason: dto.reason ?? appointment.reason,
      notes: dto.notes ?? appointment.notes,
    });
    await this.repo(ds).save(appointment);
    return this.get(ds, id);
  }

  async remove(ds: DataSource, id: string): Promise<void> {
    const result = await this.repo(ds).delete({ id });
    if (!result.affected) {
      throw new NotFoundException('Appointment not found.');
    }
  }
}
