/**
 * Admin File Upload API Route
 * Handles QR code, banner, and other admin file uploads.
 * Saves files to /public/uploads/{category}/ and returns the URL.
 *
 * POST /api/admin/upload
 * Content-Type: multipart/form-data
 * Body: { file: File, category: string }
 */

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

// Allowed file extensions (double-check even after MIME validation)
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed categories (subdirectories under /public/uploads/)
const ALLOWED_CATEGORIES = new Set([
  'qr',          // QR code images
  'banners',     // Banner images
  'profile',     // Profile images
  'general',     // General uploads
]);

// MIME to extension map for safe filename generation
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

export const POST = apiHandler(async (request) => {
  // Verify admin authentication
  const session = await requireAdmin(request);

  // Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('Invalid form data. Please try again.', 400);
  }

  const file = formData.get('file') as File | null;
  const category = formData.get('category') as string | null;

  // Validate file presence
  if (!file) {
    return apiError('No file provided', 400);
  }

  // Validate category
  const safeCategory = ALLOWED_CATEGORIES.has(category || '') ? category! : 'general';

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return apiError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
  }

  if (file.size === 0) {
    return apiError('File is empty', 400);
  }

  // Validate MIME type
  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return apiError(`File type not allowed. Allowed types: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`, 400);
  }

  // Generate safe filename
  const ext = MIME_TO_EXT[mimeType] || path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return apiError('Invalid file extension', 400);
  }

  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(6).toString('hex');
  const safeFilename = `${timestamp}_${randomStr}${ext}`;

  // Ensure upload directory exists
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', safeCategory);
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch {
    // Directory might already exist, that's fine
  }

  // Write file to disk
  const filePath = path.join(uploadDir, safeFilename);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);
  } catch (writeError) {
    logger.error('AdminUpload', 'Failed to write file to disk', writeError);
    return apiError('Failed to save file. Please try again.', 500);
  }

  // Construct the public URL
  const fileUrl = `/uploads/${safeCategory}/${safeFilename}`;

  logger.info('AdminUpload', `File uploaded by admin ${session.userId}: ${fileUrl} (${(file.size / 1024).toFixed(1)}KB)`);

  return apiSuccess({ url: fileUrl }, 'File uploaded successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
