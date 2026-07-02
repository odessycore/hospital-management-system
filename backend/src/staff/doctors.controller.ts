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
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto/doctor.dto';

@Controller('doctors')
@UseGuards(RolesGuard)
@UseInterceptors(TenantInterceptor)
@Roles(Role.HOSPITAL_ADMIN)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get()
  list(@TenantDataSource() ds: DataSource) {
    return this.doctorsService.list(ds);
  }

  @Get(':id')
  get(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.doctorsService.get(ds, id);
  }

  @Post()
  create(
    @TenantDataSource() ds: DataSource,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDoctorDto,
  ) {
    return this.doctorsService.create(ds, user, dto);
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  resendInvite(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.doctorsService.resendInvite(ds, id);
  }

  @Patch(':id')
  update(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.doctorsService.update(ds, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @TenantDataSource() ds: DataSource,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.doctorsService.remove(ds, id);
  }
}
