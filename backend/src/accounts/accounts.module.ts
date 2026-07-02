import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthUser } from '../database/master/entities/auth-user.entity';
import { AccountsService } from './accounts.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuthUser])],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
