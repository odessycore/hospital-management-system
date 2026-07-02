import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { AccountsModule } from './accounts/accounts.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MasterDatabaseModule } from './database/master/master-database.module';
import { TenantDatabaseModule } from './database/tenant/tenant-database.module';
import { InvitationsModule } from './invitations/invitations.module';
import { MailerModule } from './mailer/mailer.module';
import { StaffModule } from './staff/staff.module';
import { StatsModule } from './stats/stats.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MasterDatabaseModule,
    TenantDatabaseModule,
    MailerModule,
    AccountsModule,
    InvitationsModule,
    AuthModule,
    TenantsModule,
    StaffModule,
    AppointmentsModule,
    StatsModule,
  ],
  providers: [
    // Enforce JWT on every route unless marked @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
