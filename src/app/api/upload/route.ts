/**
 * User File Upload API Route
 * Handles user screenshot uploads for recharge proofs, etc.
 * Saves files to /public/uploads/screenshots/ and returns the URL.
 *
 * POST /api/upload
 * Content-Type: multipart/form-data
 * Body: { file: File }
 */

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

// Allowed file extensions
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// MIME to extension map
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

export const POST = apiHandler(async (request) => {
  // Verify user authentication
  const session = await requireAuth(request);

  // Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('Invalid form data. Please try again.', 400);
  }

  const file = formData.get('file') as File | null;

  // Validate file presence
  if (!file) {
    return apiError('No file provided', 400);
  }

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
    return apiError(`File type not allowed. Allowed types: PNG, JPEG, WebP`, 400);
  }

  // Generate safe filename with user ID prefix for traceability
  const ext = MIME_TO_EXT[mimeType] || path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return apiError('Invalid file extension', 400);
  }

  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(6).toString('hex');
  const safeFilename = `${session.userId}_${timestamp}_${randomStr}${ext}`;

  // Ensure upload directory exists
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'screenshots');
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  // Write file to disk
  const filePath = path.join(uploadDir, safeFilename);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);
  } catch (writeError) {
    logger.error('UserUpload', 'Failed to write file to disk', writeError);
    return apiError('Failed to save file. Please try again.', 500);
  }

  // Construct the public URL
  const fileUrl = `/uploads/screenshots/${safeFilename}`;

  logger.info('UserUpload', `Screenshot uploaded by user ${session.userId}: ${fileUrl} (${(file.size / 1024).toFixed(1)}KB)`);

  return apiSuccess({ url: fileUrl }, 'File uploaded successfully');
}, { rateLimit: RATE_LIMITS.RECHARGE });
