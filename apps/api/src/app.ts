import Fastify, { type FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import type Database from 'better-sqlite3'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod'
import type { Clock } from '@nowwhat/shared'
import type { AppDb } from './db/client.ts'
import { healthRoutes } from './routes/health.ts'

export interface AppDeps {
  clock: Clock
  db: AppDb
  sqlite: Database.Database
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(swagger, {
    transform: jsonSchemaTransform,
    openapi: {
      info: {
        title: 'Now What API',
        version: '0.1.0',
        description: '日程规划应用接口'
      },
      servers: [{ url: '/' }]
    }
  })

  app.register(healthRoutes, deps)

  return app
}
