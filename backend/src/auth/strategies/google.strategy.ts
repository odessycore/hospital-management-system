import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AppConfig } from '../../config/configuration';
import { GoogleProfile } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<AppConfig, true>) {
    const google = config.get('google', { infer: true });
    super({
      clientID: google.clientId || 'missing-client-id',
      clientSecret: google.clientSecret || 'missing-client-secret',
      callbackURL: google.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account did not return an email address.'), false);
      return;
    }
    const mapped: GoogleProfile = {
      email,
      googleId: profile.id,
      fullName: profile.displayName || email,
    };
    done(null, mapped);
  }
}
