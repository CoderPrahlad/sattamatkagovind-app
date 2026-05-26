import { apiHandler, apiSuccess } from '@/lib/api-utils'
import { db } from '@/lib/db'

export const POST = apiHandler(async (req: Request) => {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const body = await req.json().catch(() => ({}))

  await db.appDownload.create({
    data: {
      ipAddress: ip,
      source: body.source || 'external',
    }
  })

  return apiSuccess({ tracked: true })
})

export const GET = apiHandler(async () => {
  const total = await db.appDownload.count()

  const today = await db.appDownload.count({
    where: {
      downloadedAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  })

  return apiSuccess({ total, today })
})