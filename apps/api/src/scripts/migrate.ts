import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, runMigrations } from '../db/client.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')

const file = process.env.DATABASE_URL ?? path.join(repoRoot, 'data', 'nowwhat.db')
mkdirSync(path.dirname(file), { recursive: true })

const { db, sqlite } = createDb(file)
runMigrations(db)
sqlite.close()

console.log(`[db] migrated ${file}`)
