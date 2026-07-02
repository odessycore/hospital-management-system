import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Injects the resolved per-tenant TypeORM DataSource for the current request.
 * Requires TenantInterceptor to have run (which populates `req.tenantDataSource`).
 */
export const TenantDataSource = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DataSource => {
    const request = ctx.switchToHttp().getRequest();
    const dataSource: DataSource | undefined = request.tenantDataSource;
    if (!dataSource) {
      throw new InternalServerErrorException(
        'Tenant database connection was not resolved for this request.',
      );
    }
    return dataSource;
  },
);
