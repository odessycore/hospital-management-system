/**
 * Seeds the master database + two fully-populated tenant hospitals.
 * Idempotent: existing seeded tenants are dropped and recreated on each run.
 *
 *   npm run seed
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import * as bcrypt from 'bcrypt';
import { DataSource, DataSourceOptions } from 'typeorm';
import configuration from '../config/configuration';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../database/master/entities/auth-user.entity';
import { RefreshToken } from '../database/master/entities/refresh-token.entity';
import { Tenant } from '../database/master/entities/tenant.entity';
import { Appointment } from '../database/tenant/entities/appointment.entity';
import { Doctor } from '../database/tenant/entities/doctor.entity';
import { Patient } from '../database/tenant/entities/patient.entity';
import { TENANT_ENTITIES } from '../database/tenant/tenant-entities';

const cfg = configuration();

function baseConn(database: string): DataSourceOptions {
  return {
    type: 'postgres',
    host: cfg.db.host,
    port: cfg.db.port,
    username: cfg.db.username,
    password: cfg.db.password,
    database,
  };
}

async function ensureDatabase(name: string): Promise<void> {
  const admin = new DataSource(baseConn(cfg.db.bootstrapName));
  await admin.initialize();
  try {
    const rows = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${name}"`);
      console.log(`  • created database ${name}`);
    }
  } finally {
    await admin.destroy();
  }
}

async function dropDatabase(name: string): Promise<void> {
  const admin = new DataSource(baseConn(cfg.db.bootstrapName));
  await admin.initialize();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  } finally {
    await admin.destroy();
  }
}

const at = (daysFromNow: number, hour: number, minute = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
};

interface DoctorSeed {
  fullName: string;
  email: string;
  specialization: string;
  phone: string;
  licenseNumber: string;
}
interface PatientSeed {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  address: string;
}
interface TenantSeed {
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  admin: { fullName: string; email: string };
  doctors: DoctorSeed[];
  patients: PatientSeed[];
}

const TENANTS: TenantSeed[] = [
  {
    name: "St. Mary's General Hospital",
    slug: 'st-marys',
    address: '128 Trinity Avenue, Boston, MA 02118',
    phone: '+1 (617) 555-0142',
    email: 'contact@stmarys-health.io',
    admin: { fullName: 'Margaret Whitfield', email: 'admin@stmarys.io' },
    doctors: [
      { fullName: 'Dr. Alan Grant', email: 'alan.grant@stmarys.io', specialization: 'Cardiology', phone: '+1 (617) 555-0180', licenseNumber: 'MA-CARD-4471' },
      { fullName: 'Dr. Ellie Sattler', email: 'ellie.sattler@stmarys.io', specialization: 'Neurology', phone: '+1 (617) 555-0181', licenseNumber: 'MA-NEUR-2210' },
      { fullName: 'Dr. Ian Malcolm', email: 'ian.malcolm@stmarys.io', specialization: 'Orthopedics', phone: '+1 (617) 555-0182', licenseNumber: 'MA-ORTH-9931' },
      { fullName: 'Dr. Sarah Harding', email: 'sarah.harding@stmarys.io', specialization: 'Pediatrics', phone: '+1 (617) 555-0183', licenseNumber: 'MA-PEDI-5567' },
    ],
    patients: [
      { fullName: 'John Hammond', email: 'john.hammond@example.com', phone: '+1 (617) 555-0201', dateOfBirth: '1948-05-12', gender: 'Male', bloodGroup: 'O+', address: '9 Cranborne Chase, Boston, MA' },
      { fullName: 'Lex Murphy', email: 'lex.murphy@example.com', phone: '+1 (617) 555-0202', dateOfBirth: '2005-09-23', gender: 'Female', bloodGroup: 'A+', address: '14 Isla Road, Boston, MA' },
      { fullName: 'Tim Murphy', email: 'tim.murphy@example.com', phone: '+1 (617) 555-0203', dateOfBirth: '2008-02-17', gender: 'Male', bloodGroup: 'A-', address: '14 Isla Road, Boston, MA' },
      { fullName: 'Donald Gennaro', email: 'donald.gennaro@example.com', phone: '+1 (617) 555-0204', dateOfBirth: '1979-11-03', gender: 'Male', bloodGroup: 'B+', address: '2200 Cocoa Beach, Boston, MA' },
      { fullName: 'Ray Arnold', email: 'ray.arnold@example.com', phone: '+1 (617) 555-0205', dateOfBirth: '1962-07-29', gender: 'Male', bloodGroup: 'AB+', address: '77 Control Room Ln, Boston, MA' },
      { fullName: 'Gerry Harding', email: 'gerry.harding@example.com', phone: '+1 (617) 555-0206', dateOfBirth: '1985-03-14', gender: 'Female', bloodGroup: 'O-', address: '5 Paddock View, Boston, MA' },
    ],
  },
  {
    name: 'Riverside Medical Center',
    slug: 'riverside',
    address: '4500 River Parkway, Austin, TX 78701',
    phone: '+1 (512) 555-0110',
    email: 'hello@riverside-med.io',
    admin: { fullName: 'Charles Okafor', email: 'admin@riverside.io' },
    doctors: [
      { fullName: 'Dr. Meredith Grey', email: 'meredith.grey@riverside.io', specialization: 'General Surgery', phone: '+1 (512) 555-0150', licenseNumber: 'TX-SURG-3320' },
      { fullName: 'Dr. Derek Shepherd', email: 'derek.shepherd@riverside.io', specialization: 'Neurosurgery', phone: '+1 (512) 555-0151', licenseNumber: 'TX-NSUR-8890' },
      { fullName: 'Dr. Miranda Bailey', email: 'miranda.bailey@riverside.io', specialization: 'Internal Medicine', phone: '+1 (512) 555-0152', licenseNumber: 'TX-INTM-1145' },
    ],
    patients: [
      { fullName: 'George O\'Malley', email: 'george.omalley@example.com', phone: '+1 (512) 555-0230', dateOfBirth: '1990-01-22', gender: 'Male', bloodGroup: 'B-', address: '18 Seattle Grace Rd, Austin, TX' },
      { fullName: 'Izzie Stevens', email: 'izzie.stevens@example.com', phone: '+1 (512) 555-0231', dateOfBirth: '1988-06-30', gender: 'Female', bloodGroup: 'A+', address: '42 Meadow Ln, Austin, TX' },
      { fullName: 'Alex Karev', email: 'alex.karev@example.com', phone: '+1 (512) 555-0232', dateOfBirth: '1986-12-08', gender: 'Male', bloodGroup: 'O+', address: '90 Iowa St, Austin, TX' },
      { fullName: 'Callie Torres', email: 'callie.torres@example.com', phone: '+1 (512) 555-0233', dateOfBirth: '1983-04-19', gender: 'Female', bloodGroup: 'AB-', address: '3 Ortho Ave, Austin, TX' },
      { fullName: 'Preston Burke', email: 'preston.burke@example.com', phone: '+1 (512) 555-0234', dateOfBirth: '1975-10-11', gender: 'Male', bloodGroup: 'O+', address: '61 Cardio Blvd, Austin, TX' },
    ],
  },
];

async function seed() {
  const password = cfg.seed.defaultPassword;
  const passwordHash = await bcrypt.hash(password, 10);
  console.log('\n🌱  Seeding Hospital Management System\n');

  // 1) Master database + schema
  await ensureDatabase(cfg.db.masterName);
  const master = new DataSource({
    ...baseConn(cfg.db.masterName),
    entities: [Tenant, AuthUser, RefreshToken],
    synchronize: true,
  });
  await master.initialize();

  const tenantRepo = master.getRepository(Tenant);
  const authRepo = master.getRepository(AuthUser);

  // 2) Reset: drop previously-seeded tenant DBs and clear master tables
  const existingTenants = await tenantRepo.find();
  for (const t of existingTenants) {
    await dropDatabase(`${cfg.db.tenantPrefix}${t.slug}`);
  }
  await master.getRepository(RefreshToken).clear();
  await authRepo.clear();
  await tenantRepo.clear();
  console.log('  • cleared master tables and old tenant databases');

  // 3) Super admin
  await authRepo.save(
    authRepo.create({
      email: 'superadmin@hospital.io',
      fullName: 'System Super Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
      tenantId: null,
      tenantSlug: null,
      profileId: null,
      isActive: true,
    }),
  );
  console.log('  • created SUPER_ADMIN (superadmin@hospital.io)');

  // 4) Tenants
  for (const spec of TENANTS) {
    console.log(`\n  ── ${spec.name} (${spec.slug}) ──`);
    const tenant = await tenantRepo.save(
      tenantRepo.create({
        name: spec.name,
        slug: spec.slug,
        address: spec.address,
        phone: spec.phone,
        email: spec.email,
        isActive: true,
      }),
    );

    const tenantDbName = `${cfg.db.tenantPrefix}${spec.slug}`;
    await ensureDatabase(tenantDbName);
    const tenantDs = new DataSource({
      ...baseConn(tenantDbName),
      entities: TENANT_ENTITIES,
      synchronize: true,
    });
    await tenantDs.initialize();

    const doctorRepo = tenantDs.getRepository(Doctor);
    const patientRepo = tenantDs.getRepository(Patient);
    const appointmentRepo = tenantDs.getRepository(Appointment);

    // Hospital admin
    await authRepo.save(
      authRepo.create({
        email: spec.admin.email,
        fullName: spec.admin.fullName,
        passwordHash,
        role: Role.HOSPITAL_ADMIN,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        profileId: null,
        isActive: true,
      }),
    );
    console.log(`    • HOSPITAL_ADMIN ${spec.admin.email}`);

    // Doctors (login + profile)
    const doctorIds: string[] = [];
    for (const d of spec.doctors) {
      const login = await authRepo.save(
        authRepo.create({
          email: d.email,
          fullName: d.fullName,
          passwordHash,
          role: Role.DOCTOR,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          profileId: null,
          isActive: true,
        }),
      );
      const doctor = await doctorRepo.save(
        doctorRepo.create({
          authUserId: login.id,
          fullName: d.fullName,
          email: d.email,
          phone: d.phone,
          specialization: d.specialization,
          licenseNumber: d.licenseNumber,
          isActive: true,
        }),
      );
      login.profileId = doctor.id;
      await authRepo.save(login);
      doctorIds.push(doctor.id);
    }
    console.log(`    • ${spec.doctors.length} doctors`);

    // Patients (login + profile)
    const patientIds: string[] = [];
    for (const p of spec.patients) {
      const login = await authRepo.save(
        authRepo.create({
          email: p.email,
          fullName: p.fullName,
          passwordHash,
          role: Role.PATIENT,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          profileId: null,
          isActive: true,
        }),
      );
      const patient = await patientRepo.save(
        patientRepo.create({
          authUserId: login.id,
          fullName: p.fullName,
          email: p.email,
          phone: p.phone,
          dateOfBirth: p.dateOfBirth,
          gender: p.gender,
          bloodGroup: p.bloodGroup,
          address: p.address,
          isActive: true,
        }),
      );
      login.profileId = patient.id;
      await authRepo.save(login);
      patientIds.push(patient.id);
    }
    console.log(`    • ${spec.patients.length} patients`);

    // Appointments — mix of completed history and upcoming
    const reasons = [
      'Routine check-up',
      'Follow-up consultation',
      'Post-operative review',
      'Chronic condition management',
      'Diagnostic evaluation',
      'Annual physical examination',
      'Lab results discussion',
    ];
    const plan: Array<{
      d: number;
      p: number;
      when: Date;
      status: AppointmentStatus;
      dur: number;
    }> = [
      { d: 0, p: 0, when: at(-21, 9), status: AppointmentStatus.COMPLETED, dur: 30 },
      { d: 1, p: 1, when: at(-14, 11), status: AppointmentStatus.COMPLETED, dur: 45 },
      { d: 2, p: 2, when: at(-9, 14), status: AppointmentStatus.COMPLETED, dur: 30 },
      { d: 0, p: 3, when: at(-5, 10, 30), status: AppointmentStatus.CANCELLED, dur: 30 },
      { d: 1, p: 4, when: at(-3, 15), status: AppointmentStatus.NO_SHOW, dur: 30 },
      { d: 3 % 1, p: 0, when: at(-1, 13), status: AppointmentStatus.COMPLETED, dur: 20 },
      { d: 0, p: 1, when: at(1, 9, 30), status: AppointmentStatus.SCHEDULED, dur: 30 },
      { d: 1, p: 2, when: at(2, 11), status: AppointmentStatus.SCHEDULED, dur: 45 },
      { d: 2, p: 3, when: at(4, 14, 30), status: AppointmentStatus.SCHEDULED, dur: 30 },
      { d: 0, p: 4, when: at(7, 10), status: AppointmentStatus.SCHEDULED, dur: 30 },
      { d: 1, p: 0, when: at(10, 16), status: AppointmentStatus.SCHEDULED, dur: 30 },
    ];

    let count = 0;
    for (const a of plan) {
      const doctorId = doctorIds[a.d % doctorIds.length];
      const patientId = patientIds[a.p % patientIds.length];
      if (!doctorId || !patientId) continue;
      await appointmentRepo.save(
        appointmentRepo.create({
          doctorId,
          patientId,
          scheduledAt: a.when,
          durationMinutes: a.dur,
          status: a.status,
          reason: reasons[count % reasons.length],
          notes:
            a.status === AppointmentStatus.COMPLETED
              ? 'Patient stable. Continue current treatment plan.'
              : null,
        }),
      );
      count++;
    }
    console.log(`    • ${count} appointments`);

    await tenantDs.destroy();
  }

  await master.destroy();

  console.log('\n✅  Seed complete.\n');
  console.log('   Login credentials (password for ALL demo accounts):');
  console.log(`   Password: ${password}\n`);
  console.log('   SUPER_ADMIN     superadmin@hospital.io');
  console.log('   HOSPITAL_ADMIN  admin@stmarys.io   /  admin@riverside.io');
  console.log('   DOCTOR          alan.grant@stmarys.io  /  meredith.grey@riverside.io');
  console.log('   PATIENT         john.hammond@example.com  /  george.omalley@example.com\n');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌  Seed failed:', err);
    process.exit(1);
  });
