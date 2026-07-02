import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantDataSource } from '../common/decorators/tenant-datasource.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { TenantInterceptor } from '../database/tenant/tenant.interceptor';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(RolesGuard)
@UseInterceptors(TenantInterceptor)
@Roles(Role.HOSPITAL_ADMIN)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list(@TenantDataSource() ds: DataSource) {
    return this.patientsService.list(ds);
  }

  @Get(':id')
  get(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.get(ds, id);
  }

  @Post()
  create(
    @TenantDataSource() ds: DataSource,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(ds, user, dto);
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  resendInvite(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.resendInvite(ds, id);
  }

  @Patch(':id')
  update(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(ds, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.remove(ds, id);
  }
}
