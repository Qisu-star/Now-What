import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type Database from 'better-sqlite3'
import { z } from 'zod'
import { isoUtc, type Clock } from '@nowwhat/shared'

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.literal('ok'),
  time: z.string()
})

export interface HealthDeps {
  clock: Clock
  sqlite: Database.Database
}

export async function healthRoutes(app: FastifyInstance, deps: HealthDeps): Promise<void> {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/api/v1/health',
    {
      schema: {
        tags: ['system'],
        summary: '健康检查',
        description: '确认服务与数据库均可用，并返回服务端当前时间。',
        response: { 200: healthResponseSchema }
      }
    },
    async () => {
      deps.sqlite.prepare('select 1').get()
      return { status: 'ok' as const, db: 'ok' as const, time: isoUtc(deps.clock.now()) }
    }
  )
}
