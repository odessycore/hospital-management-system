import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

/** Hospital-admin management of doctors and patients within a tenant. */
@Module({
  controllers: [DoctorsController, PatientsController],
  providers: [DoctorsService, PatientsService],
})
export class StaffModule {}
