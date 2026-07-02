import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SetPasswordDto } from './dto/set-password.dto';
import { InvitationsService } from './invitations.service';

/** Public endpoints backing the "set your password" invitation screen. */
@Controller('auth')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Public()
  @Get('invitation/:token')
  describe(@Param('token') token: string) {
    return this.invitations.describe(token);
  }

  @Public()
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  setPassword(@Body() dto: SetPasswordDto) {
    return this.invitations.setPassword(dto.token, dto.password);
  }
}
