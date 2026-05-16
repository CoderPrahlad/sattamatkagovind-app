import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasourceUrl: process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), 'db/custom.db')}`,
})