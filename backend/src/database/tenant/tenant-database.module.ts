import { Global, Module } from '@nestjs/common';
import { TenantConnectionService } from './tenant-connection.service';
import { TenantInterceptor } from './tenant.interceptor';

/**
 * Provides the per-tenant connection machinery application-wide.
 * Global so any feature module can inject TenantConnectionService / the interceptor.
 */
@Global()
@Module({
  providers: [TenantConnectionService, TenantInterceptor],
  exports: [TenantConnectionService, TenantInterceptor],
})
export class TenantDatabaseModule {}
