CREATE TABLE "MigrationRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outcome" TEXT NOT NULL DEFAULT 'RUNNING',
    "sourceCounts" JSONB NOT NULL,
    "targetCounts" JSONB NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "MigrationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MigrationRun_startedAt_idx" ON "MigrationRun"("startedAt");
