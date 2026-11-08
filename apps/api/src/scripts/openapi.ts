import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { systemClock } from '@nowwhat/shared'
import { buildApp } from '../app.ts'
import { createDb, runMigrations } from '../db/client.ts'

const { db, sqlite } = createDb(':memory:')
runMigrations(db)

const app = await buildApp({ clock: systemClock, db, sqlite })
await app.ready()
const spec = app.swagger()

const target = fileURLToPath(new URL('../../openapi.json', import.meta.url))
writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`, 'utf8')

await app.close()
sqlite.close()

console.log(`[openapi] wrote ${target}`)
