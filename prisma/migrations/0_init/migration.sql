-- CreateSchema
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."OtpType" AS ENUM ('REGISTER', 'FORGOT_PASSWORD');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "public"."TicketStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REVOKED_BY_ADMIN', 'HELD', 'EXPIRED', 'USED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "batchId" TEXT,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlacklistedIPs" (
    "id" SERIAL NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userId" INTEGER,
    "reason" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlacklistedIPs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OTP" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "type" "public"."OtpType" NOT NULL DEFAULT 'REGISTER',

    CONSTRAINT "OTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tickets" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tripId" INTEGER NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "status" "public"."TicketStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Trips" (
    "id" SERIAL NOT NULL,
    "route" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "totalSeats" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(1536),
    "description" TEXT,

    CONSTRAINT "Trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatarUrl" TEXT,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Wallets" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Wallets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_batchId_idx" ON "public"."AuditLog"("batchId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "public"."AuditLog"("requestId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedIPs_ipAddress_key" ON "public"."BlacklistedIPs"("ipAddress" ASC);

-- CreateIndex
CREATE INDEX "OTP_email_code_idx" ON "public"."OTP"("email" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "OTP_email_type_idx" ON "public"."OTP"("email" ASC, "type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tickets_tripId_seatNumber_key" ON "public"."Tickets"("tripId" ASC, "seatNumber" ASC);

-- CreateIndex
CREATE INDEX "Tickets_userId_idx" ON "public"."Tickets"("userId" ASC);

-- CreateIndex
CREATE INDEX "Trips_route_departureAt_idx" ON "public"."Trips"("route" ASC, "departureAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "public"."Users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Wallets_userId_key" ON "public"."Wallets"("userId" ASC);

-- AddForeignKey
ALTER TABLE "public"."Tickets" ADD CONSTRAINT "Tickets_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tickets" ADD CONSTRAINT "Tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Wallets" ADD CONSTRAINT "Wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
