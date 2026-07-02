import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../config/configuration';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Thin wrapper around nodemailer.
 *
 * If SMTP credentials (MAIL_HOST) are configured it sends real email; otherwise
 * it falls back to a JSON transport and logs the message so the invite link is
 * always visible in the server console during local development.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter!: nodemailer.Transporter;
  private liveSmtp = false;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const mail = this.config.get('mail', { infer: true });
    if (mail.host) {
      this.transporter = nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.secure,
        auth: mail.user ? { user: mail.user, pass: mail.password } : undefined,
      });
      this.liveSmtp = true;
      this.logger.log(`SMTP transport ready (${mail.host}:${mail.port})`);
    } else {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.warn(
        'MAIL_HOST not set — emails will be logged to the console instead of sent.',
      );
    }
  }

  async send(input: SendMailInput): Promise<void> {
    const from = this.config.get('mail', { infer: true }).from;
    const info = await this.transporter.sendMail({ from, ...input });

    if (!this.liveSmtp) {
      this.logger.log(
        `\n──────────── ✉️  DEV EMAIL (not actually sent) ────────────\n` +
          `To:      ${input.to}\n` +
          `Subject: ${input.subject}\n` +
          `${input.text}\n` +
          `───────────────────────────────────────────────────────────`,
      );
    } else {
      this.logger.log(`Email sent to ${input.to} (id: ${info.messageId})`);
    }
  }
}
