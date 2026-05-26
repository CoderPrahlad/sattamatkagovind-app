-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "balance" REAL NOT NULL DEFAULT 0,
    "winningAmount" REAL NOT NULL DEFAULT 0,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "referralBonusClaimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "declaredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "bidType" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winAmount" REAL,
    "targetDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bid_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "upiNumber" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "ifscCode" TEXT,
    "accountHolder" TEXT,
    "accountNumber" TEXT,
    "upiId" TEXT,
    "utrNumber" TEXT,
    "screenshotUrl" TEXT,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BankDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountHolder" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "bankName" TEXT,
    "upiId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "adminReply" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtpEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mobile" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'sms',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppDownload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "downloadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "source" TEXT DEFAULT 'external'
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_referredBy_idx" ON "User"("referredBy");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Game_name_key" ON "Game"("name");

-- CreateIndex
CREATE INDEX "GameResult_gameId_date_idx" ON "GameResult"("gameId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_gameId_date_key" ON "GameResult"("gameId", "date");

-- CreateIndex
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE INDEX "Bid_gameId_idx" ON "Bid"("gameId");

-- CreateIndex
CREATE INDEX "Bid_status_idx" ON "Bid"("status");

-- CreateIndex
CREATE INDEX "Bid_gameId_targetDate_idx" ON "Bid"("gameId", "targetDate");

-- CreateIndex
CREATE INDEX "Bid_userId_status_idx" ON "Bid"("userId", "status");

-- CreateIndex
CREATE INDEX "Bid_userId_createdAt_idx" ON "Bid"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_targetDate_status_idx" ON "Bid"("targetDate", "status");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_status_idx" ON "WalletTransaction"("type", "status");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_status_idx" ON "WalletTransaction"("userId", "status");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_createdAt_idx" ON "WalletTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "GameConfig_key_key" ON "GameConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "BankDetail_userId_key" ON "BankDetail"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "TicketReply_ticketId_idx" ON "TicketReply"("ticketId");

-- CreateIndex
CREATE INDEX "TicketReply_createdAt_idx" ON "TicketReply"("createdAt");

-- CreateIndex
CREATE INDEX "OtpEntry_mobile_purpose_idx" ON "OtpEntry"("mobile", "purpose");

-- CreateIndex
CREATE INDEX "AppDownload_downloadedAt_idx" ON "AppDownload"("downloadedAt");
