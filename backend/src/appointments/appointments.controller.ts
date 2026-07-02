import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { AppointmentsService, AppointmentView } from './appointments.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

@Controller('appointments')
@UseGuards(RolesGuard)
@UseInterceptors(TenantInterceptor)
@Roles(Role.HOSPITAL_ADMIN, Role.DOCTOR, Role.PATIENT)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /** Role-scoped list. `view` = upcoming | history | all (default all). */
  @Get()
  list(
    @TenantDataSource() ds: DataSource,
    @CurrentUser() user: AuthenticatedUser,
    @Query('view') view: AppointmentView = 'all',
  ) {
    const allowed: AppointmentView[] = ['upcoming', 'history', 'all'];
    const safeView = allowed.includes(view) ? view : 'all';
    return this.appointmentsService.listForUser(ds, user, safeView);
  }

  @Get(':id')
  get(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.get(ds, id);
  }

  // ── Write operations: HOSPITAL_ADMIN only ──
  @Post()
  create(
    @TenantDataSource() ds: DataSource,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    this.assertAdmin(user);
    return this.appointmentsService.create(ds, dto);
  }

  @Patch(':id')
  update(
    @TenantDataSource() ds: DataSource,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    this.assertAdmin(user);
    return this.appointmentsService.update(ds, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @TenantDataSource() ds: DataSource,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.assertAdmin(user);
    return this.appointmentsService.remove(ds, id);
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (user.role !== Role.HOSPITAL_ADMIN) {
      throw new ForbiddenException(
        'Only hospital administrators can modify appointments.',
      );
    }
  }
}
