import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config/configuration';
import { TENANT_ENTITIES } from './tenant-entities';

/**
 * Owns the lifecycle of per-tenant database connections.
 *
 * - `provisionDatabase` physically CREATEs a tenant database (idempotent).
 * - `getConnection` returns a cached, initialised DataSource for a tenant slug.
 *
 * DataSources are cached by slug so we never open more than one pool per tenant.
 */
@Injectable()
export class TenantConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly connections = new Map<string, DataSource>();

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get db() {
    return this.config.get('db', { infer: true });
  }

  /** Physical database name for a tenant slug. */
  databaseName(slug: string): string {
    return `${this.db.tenantPrefix}${slug}`;
  }

  private baseOptions() {
    const db = this.db;
    return {
      type: 'postgres' as const,
      host: db.host,
      port: db.port,
      username: db.username,
      password: db.password,
    };
  }

  /**
   * Creates the tenant database if it does not yet exist, then initialises its
   * schema by opening (and caching) a synchronised DataSource.
   */
  async provisionDatabase(slug: string): Promise<DataSource> {
    const dbName = this.databaseName(slug);
    const admin = new DataSource({
      ...this.baseOptions(),
      database: this.db.bootstrapName,
    });
    await admin.initialize();
    try {
      const rows = await admin.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName],
      );
      if (rows.length === 0) {
        // Identifier is derived from a validated slug; safe to interpolate.
        await admin.query(`CREATE DATABASE "${dbName}"`);
        this.logger.log(`Provisioned tenant database "${dbName}"`);
      }
    } finally {
      await admin.destroy();
    }
    return this.getConnection(slug);
  }

  /** Returns an initialised, cached DataSource for the given tenant slug. */
  async getConnection(slug: string): Promise<DataSource> {
    const existing = this.connections.get(slug);
    if (existing) {
      return existing.isInitialized ? existing : existing.initialize();
    }

    const dataSource = new DataSource({
      ...this.baseOptions(),
      database: this.databaseName(slug),
      entities: TENANT_ENTITIES,
      synchronize: true, // dev convenience; use migrations in production
    });
    await dataSource.initialize();
    this.connections.set(slug, dataSource);
    this.logger.log(`Opened connection to tenant "${slug}"`);
    return dataSource;
  }

  /** Drops a tenant database (used when a tenant is deleted). */
  async dropDatabase(slug: string): Promise<void> {
    const dbName = this.databaseName(slug);
    const cached = this.connections.get(slug);
    if (cached?.isInitialized) {
      await cached.destroy();
    }
    this.connections.delete(slug);

    const admin = new DataSource({
      ...this.baseOptions(),
      database: this.db.bootstrapName,
    });
    await admin.initialize();
    try {
      // Terminate other sessions so DROP DATABASE can proceed.
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      this.logger.warn(`Dropped tenant database "${dbName}"`);
    } finally {
      await admin.destroy();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.connections.values()].map((ds) =>
        ds.isInitialized ? ds.destroy() : Promise.resolve(),
      ),
    );
    this.connections.clear();
  }
}
