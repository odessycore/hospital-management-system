import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { AuthUser } from '../database/master/entities/auth-user.entity';
import { Invitation } from '../database/master/entities/invitation.entity';
import { MailerService } from '../mailer/mailer.service';

export interface InvitationInfo {
  email: string;
  fullName: string;
  valid: boolean;
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitations: Repository<Invitation>,
    @InjectRepository(AuthUser)
    private readonly authUsers: Repository<AuthUser>,
    private readonly mailer: MailerService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Issues a fresh single-use invitation for an account and emails the
   * set-password link. Any outstanding invitations for the user are invalidated.
   */
  async sendInvite(authUser: AuthUser): Promise<void> {
    // Invalidate previous unused invitations (rotation / resend).
    await this.invitations.update(
      { authUserId: authUser.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawToken = randomBytes(32).toString('hex');
    const ttlHours = this.config.get('invite', { infer: true }).ttlHours;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.invitations.save(
      this.invitations.create({
        authUserId: authUser.id,
        email: authUser.email,
        tokenHash: this.hash(rawToken),
        expiresAt,
        usedAt: null,
      }),
    );

    const frontendUrl = this.config.get('frontendUrl', { infer: true });
    const link = `${frontendUrl}/set-password?token=${rawToken}`;
    await this.mailer.send(this.buildEmail(authUser.fullName, link, ttlHours, authUser.email));
  }

  /** Resolve an invitation by the account's id (used for admin "resend"). */
  async sendInviteByAuthUserId(authUserId: string): Promise<void> {
    const user = await this.authUsers.findOne({ where: { id: authUserId } });
    if (!user) throw new NotFoundException('Account not found.');
    await this.sendInvite(user);
  }

  /** Look up an invitation for the set-password screen (does not consume it). */
  async describe(rawToken: string): Promise<InvitationInfo> {
    const invitation = await this.findValid(rawToken);
    const user = await this.authUsers.findOne({
      where: { id: invitation.authUserId },
    });
    return {
      email: invitation.email,
      fullName: user?.fullName ?? invitation.email,
      valid: true,
    };
  }

  /** Consume an invitation and set the account password. */
  async setPassword(rawToken: string, newPassword: string): Promise<{ email: string }> {
    const invitation = await this.findValid(rawToken);
    const user = await this.authUsers.findOne({
      where: { id: invitation.authUserId },
    });
    if (!user) throw new NotFoundException('Account not found.');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.isActive = true;
    await this.authUsers.save(user);

    invitation.usedAt = new Date();
    await this.invitations.save(invitation);

    return { email: user.email };
  }

  private async findValid(rawToken: string): Promise<Invitation> {
    const invitation = await this.invitations.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!invitation) {
      throw new NotFoundException('This invitation link is invalid.');
    }
    if (invitation.usedAt) {
      throw new BadRequestException('This invitation link has already been used.');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'This invitation link has expired. Please ask your administrator to resend it.',
      );
    }
    return invitation;
  }

  private buildEmail(
    fullName: string,
    link: string,
    ttlHours: number,
    to: string,
  ) {
    const subject = 'Set up your Medisys account';
    const text =
      `Hello ${fullName},\n\n` +
      `An account has been created for you on Medisys. ` +
      `Set your password using the link below (valid for ${ttlHours} hours):\n\n` +
      `${link}\n\n` +
      `If you were not expecting this, you can ignore this email.`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
        <div style="background:#0d9488;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;font-size:18px">Welcome to Medisys</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hello ${fullName},</p>
          <p>An account has been created for you. Click below to set your password and sign in.</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${link}" style="background:#0d9488;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">
              Set your password
            </a>
          </p>
          <p style="color:#64748b;font-size:13px">This link is valid for ${ttlHours} hours. If the button doesn't work, paste this URL into your browser:</p>
          <p style="word-break:break-all;font-size:12px;color:#94a3b8">${link}</p>
        </div>
      </div>`;
    return { to, subject, text, html };
  }
}
