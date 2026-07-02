import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { TenantConnectionService } from './tenant-connection.service';

/**
 * Resolves the per-tenant DataSource for the authenticated user and attaches it
 * to the request as `req.tenantDataSource`, consumed via the @TenantDataSource()
 * param decorator. Apply to any controller that operates on tenant data.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly connections: TenantConnectionService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user?.tenantSlug) {
      throw new ForbiddenException(
        'This resource requires a tenant-scoped account.',
      );
    }

    request.tenantDataSource = await this.connections.getConnection(
      user.tenantSlug,
    );
    return next.handle();
  }
}
