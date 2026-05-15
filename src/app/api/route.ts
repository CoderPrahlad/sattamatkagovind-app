import { apiHandler, apiSuccess } from '@/lib/api-utils';

export const GET = apiHandler(async () => {
  return apiSuccess({ message: 'Hello, world!' });
});
