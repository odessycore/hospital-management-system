export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  frontendUrl: string;
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    bootstrapName: string;
    masterName: string;
    tenantPrefix: string;
  };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshTtlDays: number;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  invite: {
    ttlHours: number;
  };
  seed: {
    defaultPassword: string;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    bootstrapName: process.env.DB_BOOTSTRAP_NAME ?? 'postgres',
    masterName: process.env.MASTER_DB_NAME ?? 'hospital_master',
    tenantPrefix: process.env.TENANT_DB_PREFIX ?? 'hospital_tenant_',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'insecure-dev-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '7', 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ??
      'http://localhost:3000/api/auth/google/callback',
  },
  mail: {
    host: process.env.MAIL_HOST ?? '',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    secure: (process.env.MAIL_SECURE ?? 'false') === 'true',
    user: process.env.MAIL_USER ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    from: process.env.MAIL_FROM ?? 'Medisys <no-reply@medisys.local>',
  },
  invite: {
    ttlHours: parseInt(process.env.INVITE_TTL_HOURS ?? '72', 10),
  },
  seed: {
    defaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!',
  },
});
