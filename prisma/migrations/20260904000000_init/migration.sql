-- The whole Billon structure, created from this file rather than typed into a database.

CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordAlgorithm" TEXT NOT NULL DEFAULT 'bcrypt',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'GBP',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
    "taxLabel" TEXT NOT NULL DEFAULT 'VAT',
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankSortCode" TEXT,
    "paymentDetails" TEXT,
    "logoImage" BYTEA,
    "logoMimeType" TEXT,
    "logoUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "taxLabel" TEXT NOT NULL DEFAULT 'VAT',
    "note" TEXT,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "taxTotal" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceLine" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "invoiceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitRate" DECIMAL(18,4) NOT NULL,
    "taxRate" DECIMAL(9,6),
    "lineTotal" DECIMAL(18,4) NOT NULL,
    "taxAmount" DECIMAL(18,4) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceTaxEntry" (
    "id" SERIAL NOT NULL,
    "legacyId" INTEGER,
    "invoiceId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceTaxEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER,
    "subject" TEXT NOT NULL,
    "subjectId" INTEGER,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobRun" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "invoicesChanged" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,
    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_legacyId_key" ON "Account"("legacyId");
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
CREATE UNIQUE INDEX "Client_legacyId_key" ON "Client"("legacyId");
CREATE INDEX "Client_accountId_name_idx" ON "Client"("accountId", "name");
CREATE UNIQUE INDEX "Invoice_legacyId_key" ON "Invoice"("legacyId");
CREATE INDEX "Invoice_accountId_status_idx" ON "Invoice"("accountId", "status");
CREATE INDEX "Invoice_accountId_createdAt_idx" ON "Invoice"("accountId", "createdAt");
CREATE INDEX "Invoice_accountId_status_dueDate_idx" ON "Invoice"("accountId", "status", "dueDate");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- No two invoices in one account may share a number. The database itself forbids it,
-- so even a future bug in the application fails honestly instead of duplicating.
CREATE UNIQUE INDEX "Invoice_accountId_invoiceNumber_key" ON "Invoice"("accountId", "invoiceNumber");

CREATE UNIQUE INDEX "InvoiceLine_legacyId_key" ON "InvoiceLine"("legacyId");
CREATE INDEX "InvoiceLine_invoiceId_position_idx" ON "InvoiceLine"("invoiceId", "position");
CREATE UNIQUE INDEX "InvoiceTaxEntry_legacyId_key" ON "InvoiceTaxEntry"("legacyId");
CREATE INDEX "InvoiceTaxEntry_invoiceId_position_idx" ON "InvoiceTaxEntry"("invoiceId", "position");
CREATE INDEX "ActivityLog_subject_subjectId_occurredAt_idx" ON "ActivityLog"("subject", "subjectId", "occurredAt");
CREATE INDEX "ActivityLog_accountId_occurredAt_idx" ON "ActivityLog"("accountId", "occurredAt");
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt");

ALTER TABLE "Client" ADD CONSTRAINT "Client_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceTaxEntry" ADD CONSTRAINT "InvoiceTaxEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
