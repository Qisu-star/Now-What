import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema.ts'

export type AppDb = BetterSQLite3Database<typeof schema>

const here = path.dirname(fileURLToPath(import.meta.url))

/** apps/api/migrations：无论从 src 还是测试所在目录调用，路径一致 */
export const MIGRATIONS_DIR = path.resolve(here, '../../migrations')

export interface OpenedDb {
  db: AppDb
  sqlite: Database.Database
}

export function createDb(file: string): OpenedDb {
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

export function runMigrations(db: AppDb, folder: string = MIGRATIONS_DIR): void {
  migrate(db, { migrationsFolder: folder })
}
