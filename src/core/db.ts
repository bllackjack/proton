import path from "node:path";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Common database type both drivers satisfy; all core code targets this. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = { migrationsFolder: path.join(process.cwd(), "drizzle") };

/**
 * DATABASE_URL set (Neon in production) → node-postgres driver.
 * Unset → embedded PGlite under data/ so local dev works with no signup,
 * or in-memory when no path is given (tests).
 */
export async function createDb(connectionString?: string): Promise<Db> {
  if (connectionString) {
    const db = drizzleNodePg(connectionString, { schema });
    await migrateNodePg(db, MIGRATIONS);
    return db;
  }
  const db = drizzlePglite(path.join(process.cwd(), "data", "proton-dev"), {
    schema,
  });
  await migratePglite(db, MIGRATIONS);
  return db;
}

/** In-memory database for tests. */
export async function createTestDb(): Promise<Db> {
  const db = drizzlePglite("memory://", { schema });
  await migratePglite(db, MIGRATIONS);
  return db;
}

let instance: Promise<Db> | undefined;

/** Process-wide handle used by the adapters (web UI, CLI, voice). */
export function getDb(): Promise<Db> {
  instance ??= createDb(process.env.DATABASE_URL);
  return instance;
}
