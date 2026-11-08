import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import staticPlugin from '@fastify/static'
import { systemClock } from '@nowwhat/shared'
import { buildApp } from './app.ts'
import { createDb, runMigrations } from './db/client.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const webDist = path.resolve(repoRoot, 'apps/web/dist')

const databaseFile = process.env.DATABASE_URL ?? path.join(repoRoot, 'data', 'nowwhat.db')
mkdirSync(path.dirname(databaseFile), { recursive: true })

const { db, sqlite } = createDb(databaseFile)
runMigrations(db)

const app = await buildApp({ clock: systemClock, db, sqlite })

// 只有显式要求时才托管前端产物：开发环境由 Vite 提供页面
const serveWeb = process.argv.includes('--serve-web')

if (serveWeb && existsSync(webDist)) {
  await app.register(staticPlugin, { root: webDist, prefix: '/' })
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith('/api')) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Not Found' })
    }
    return reply.sendFile('index.html')
  })
}

const port = Number(process.env.PORT ?? 3000)

await app.listen({ port, host: '127.0.0.1' })
console.log(`[api] listening on http://127.0.0.1:${port}`)
if (serveWeb && existsSync(webDist)) {
  console.log(`[api] serving web from ${webDist}`)
}
