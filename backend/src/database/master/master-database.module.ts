import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config/configuration';
import { AuthUser } from './entities/auth-user.entity';
import { Invitation } from './entities/invitation.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Tenant } from './entities/tenant.entity';

/** The default (master) TypeORM connection: tenants, auth users, refresh tokens. */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const db = config.get('db', { infer: true });
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.masterName,
          entities: [Tenant, AuthUser, RefreshToken, Invitation],
          synchronize: true, // dev convenience; use migrations in production
        };
      },
    }),
  ],
})
export class MasterDatabaseModule {}
