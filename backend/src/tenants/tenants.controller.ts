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
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

/** SUPER_ADMIN-only management of hospitals (tenants). */
@Controller('tenants')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  list() {
    return this.tenantsService.listWithCounts();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.getById(id);
  }

  @Get(':id/stats')
  stats(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.getStats(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Post(':id/resend-admin-invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  resendAdminInvite(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.resendAdminInvite(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.remove(id);
  }
}
