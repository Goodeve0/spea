-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "cefrEstimate" TEXT,
    "hasUserSpeech" BOOLEAN NOT NULL DEFAULT true,
    "audioRef" TEXT,
    "timestamp" BIGINT NOT NULL,
    "radar" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "audioRef" TEXT,
    CONSTRAINT "Turn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "radar" TEXT NOT NULL,
    "topErrors" TEXT NOT NULL,
    "expressionUpgrades" TEXT NOT NULL,
    "recasts" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "cefrEstimate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Turn_sessionId_idx" ON "Turn"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_sessionId_key" ON "Report"("sessionId");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "Report"("userId");
