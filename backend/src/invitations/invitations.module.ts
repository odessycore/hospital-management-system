import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthUser } from '../database/master/entities/auth-user.entity';
import { Invitation } from '../database/master/entities/invitation.entity';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

/** Global so account-creating services (staff, tenants) can send invites. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Invitation, AuthUser])],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
