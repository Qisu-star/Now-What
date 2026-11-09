import os from 'node:os'
import path from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import multipart from '@fastify/multipart'
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
import { taskRoutes } from './routes/tasks.ts'
import { placementRoutes } from './routes/placements.ts'
import { attachmentRoutes } from './routes/attachments.ts'
import { MAX_ATTACHMENT_BYTES } from './services/attachments.ts'

export interface AppDeps {
  clock: Clock
  db: AppDb
  sqlite: Database.Database
  /** 附件落盘目录，测试里指向临时目录 */
  uploadDir?: string
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

  await app.register(multipart, {
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
    throwFileSizeLimit: false
  })

  const resolved: Required<AppDeps> = {
    ...deps,
    uploadDir: deps.uploadDir ?? path.join(os.tmpdir(), 'nowwhat-uploads')
  }

  app.register(healthRoutes, resolved)
  app.register(taskRoutes, resolved)
  app.register(placementRoutes, resolved)
  app.register(attachmentRoutes, resolved)

  return app
}
