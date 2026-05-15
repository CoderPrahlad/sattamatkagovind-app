import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { db } from '@/lib/db';

export const GET = apiHandler(async () => {
  // Simple DB query to verify connection - no stats exposed
  await db.$queryRaw`SELECT 1`;
  return apiSuccess({
    status: 'healthy',
    database: 'connected',
    timestamp: new Date().toISOString(),
  });
});
