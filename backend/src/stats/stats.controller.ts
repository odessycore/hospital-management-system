import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantDataSource } from '../common/decorators/tenant-datasource.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantInterceptor } from '../database/tenant/tenant.interceptor';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(RolesGuard)
@UseInterceptors(TenantInterceptor)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** Hospital-admin dashboard summary for the caller's own hospital. */
  @Get('hospital')
  @Roles(Role.HOSPITAL_ADMIN)
  hospital(@TenantDataSource() ds: DataSource) {
    return this.statsService.hospitalOverview(ds);
  }
}
