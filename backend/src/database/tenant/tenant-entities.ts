import { Appointment } from './entities/appointment.entity';
import { Doctor } from './entities/doctor.entity';
import { Patient } from './entities/patient.entity';

/** The set of entities that make up every per-tenant database schema. */
export const TENANT_ENTITIES = [Doctor, Patient, Appointment];
