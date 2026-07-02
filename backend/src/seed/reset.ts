/**
 * Drops the master database and every per-tenant database. Destructive.
 *
 *   npm run db:reset
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import configuration from '../config/configuration';

const cfg = configuration();

async function reset() {
  const admin = new DataSource({
    type: 'postgres',
    host: cfg.db.host,
    port: cfg.db.port,
    username: cfg.db.username,
    password: cfg.db.password,
    database: cfg.db.bootstrapName,
  });
  await admin.initialize();

  const rows: Array<{ datname: string }> = await admin.query(
    `SELECT datname FROM pg_database
     WHERE datname = $1 OR datname LIKE $2`,
    [cfg.db.masterName, `${cfg.db.tenantPrefix}%`],
  );

  for (const { datname } of rows) {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [datname],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${datname}"`);
    console.log(`  • dropped ${datname}`);
  }

  await admin.destroy();
  console.log('\n✅  Reset complete.\n');
}

reset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Reset failed:', err);
    process.exit(1);
  });
