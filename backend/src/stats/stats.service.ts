import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Appointment } from '../database/tenant/entities/appointment.entity';
import { Doctor } from '../database/tenant/entities/doctor.entity';
import { Patient } from '../database/tenant/entities/patient.entity';

@Injectable()
export class StatsService {
  /** Dashboard summary for a single hospital (tenant DB). */
  async hospitalOverview(ds: DataSource) {
    const doctorRepo = ds.getRepository(Doctor);
    const patientRepo = ds.getRepository(Patient);
    const appointmentRepo = ds.getRepository(Appointment);

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [
      doctorCount,
      patientCount,
      appointmentCount,
      upcomingCount,
      todayCount,
      statusRows,
      recent,
    ] = await Promise.all([
      doctorRepo.count(),
      patientRepo.count(),
      appointmentRepo.count(),
      appointmentRepo
        .createQueryBuilder('a')
        .where('a.scheduledAt >= :now', { now })
        .andWhere('a.status = :s', { s: AppointmentStatus.SCHEDULED })
        .getCount(),
      appointmentRepo
        .createQueryBuilder('a')
        .where('a.scheduledAt >= :start AND a.scheduledAt < :end', {
          start: startOfToday,
          end: endOfToday,
        })
        .getCount(),
      appointmentRepo
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('a.status')
        .getRawMany<{ status: AppointmentStatus; count: string }>(),
      appointmentRepo.find({
        relations: { doctor: true, patient: true },
        order: { scheduledAt: 'DESC' },
        take: 6,
      }),
    ]);

    const statusBreakdown = Object.values(AppointmentStatus).reduce(
      (acc, status) => {
        acc[status] =
          Number(statusRows.find((r) => r.status === status)?.count) || 0;
        return acc;
      },
      {} as Record<AppointmentStatus, number>,
    );

    return {
      counts: {
        doctorCount,
        patientCount,
        appointmentCount,
        upcomingCount,
        todayCount,
      },
      statusBreakdown,
      recentAppointments: recent.map((a) => ({
        id: a.id,
        scheduledAt: a.scheduledAt,
        status: a.status,
        reason: a.reason,
        doctorName: a.doctor?.fullName ?? 'Unknown',
        patientName: a.patient?.fullName ?? 'Unknown',
      })),
    };
  }
}
