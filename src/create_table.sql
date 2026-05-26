CREATE TABLE IF NOT EXISTS "AppDownload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "downloadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "source" TEXT DEFAULT 'external'
);
CREATE INDEX IF NOT EXISTS "AppDownload_downloadedAt_idx" ON "AppDownload"("downloadedAt");