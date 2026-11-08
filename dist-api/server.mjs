var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// database/prismaClient.ts
import { PrismaClient } from "@prisma/client";
import dotenv2 from "dotenv";
import path from "path";
var dbUrl, basePrisma, prisma, prismaClient_default;
var init_prismaClient = __esm({
  "database/prismaClient.ts"() {
    dotenv2.config({ path: path.resolve(process.cwd(), ".env") });
    dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL ch\u01B0a \u0111\u01B0\u1EE3c khai b\xE1o trong file .env!");
    }
    basePrisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl
        }
      }
    });
    prisma = basePrisma.$extends({
      query: {
        auditLog: {
          // Kiểm soát lệnh UPDATE đơn lẻ
          async update({ args, query }) {
            const dataKeys = Object.keys(args.data || {});
            const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");
            if (illegalKeys.length > 0) {
              throw new Error(
                `\u26D4 SECURITY ERROR: B\u1EA3ng AuditLog l\xE0 Append-Only! Ch\u1EC9 \u0111\u01B0\u1EE3c ph\xE9p c\u1EADp nh\u1EADt tr\u01B0\u1EDDng 'isRevoked'. C\xE1c tr\u01B0\u1EDDng vi ph\u1EA1m: [${illegalKeys.join(
                  ", "
                )}]`
              );
            }
            return query(args);
          },
          // Kiểm soát lệnh UPDATE hàng loạt (Batch Revoke)
          async updateMany({ args, query }) {
            const dataKeys = Object.keys(args.data || {});
            const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");
            if (illegalKeys.length > 0) {
              throw new Error(
                `\u26D4 SECURITY ERROR: Kh\xF4ng \u0111\u01B0\u1EE3c ph\xE9p s\u1EEDa h\xE0ng lo\u1EA1t d\u1EEF li\u1EC7u AuditLog! Ch\u1EC9 cho ph\xE9p s\u1EEDa 'isRevoked'. C\xE1c tr\u01B0\u1EDDng vi ph\u1EA1m: [${illegalKeys.join(
                  ", "
                )}]`
              );
            }
            return query(args);
          },
          // Chặn tuyệt đối mọi thao tác DELETE
          async delete() {
            throw new Error(
              "\u26D4 SECURITY ERROR: B\u1EA3ng AuditLog l\xE0 Append-Only! Nghi\xEAm c\u1EA5m m\u1ECDi h\xE0nh vi DELETE."
            );
          },
          async deleteMany() {
            throw new Error(
              "\u26D4 SECURITY ERROR: Nghi\xEAm c\u1EA5m m\u1ECDi h\xE0nh vi DELETE h\xE0ng lo\u1EA1t AuditLog."
            );
          }
        }
      }
    });
    prismaClient_default = prisma;
  }
});

// queues/mailQueue.ts
var mailQueue_exports = {};
__export(mailQueue_exports, {
  mailQueue: () => mailQueue
});
import { Queue } from "bullmq";
import Redis from "ioredis";
var redisConnection, mailQueue;
var init_mailQueue = __esm({
  "queues/mailQueue.ts"() {
    redisConnection = new Redis(
      process.env.REDIS_URL || "redis://localhost:6379",
      {
        maxRetriesPerRequest: null
      }
    );
    mailQueue = new Queue("mail-queue", {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2e3 },
        removeOnComplete: true,
        removeOnFail: 100
      }
    });
  }
});

// Service/aiProxy.service.ts
import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
var AIProxyService;
var init_aiProxy_service = __esm({
  "Service/aiProxy.service.ts"() {
    AIProxyService = class {
      // Cấu hình danh sách Key ưu tiên: Primary trước, Secondary dự phòng
      static providers = [
        {
          name: "Gemini-Primary",
          apiKey: process.env.GEMINI_PRIMARY_KEY || "",
          modelName: "gemini-2.5-flash"
        },
        {
          name: "Gemini-Secondary",
          apiKey: process.env.GEMINI_SECONDARY_KEY || "",
          modelName: "gemini-2.5-flash"
        }
      ];
      /**
       * 1. Sinh văn bản / Chat có cơ chế tự động Failover
       */
      static async generateWithFallback(prompt) {
        let lastError = null;
        for (const provider of this.providers) {
          if (!provider.apiKey) continue;
          try {
            console.log(`[AI Proxy] \u0110ang x\u1EED l\xFD qua Provider: ${provider.name}...`);
            const genAI = new GoogleGenerativeAI(provider.apiKey);
            const model = genAI.getGenerativeModel({ model: provider.modelName });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            if (responseText) {
              return responseText;
            }
          } catch (error) {
            lastError = error;
            console.warn(
              ` [AI Proxy] Provider ${provider.name} th\u1EA5t b\u1EA1i (${error.message}). \u0110ang t\u1EF1 \u0111\u1ED9ng chuy\u1EC3n sang Provider d\u1EF1 ph\xF2ng...`
            );
          }
        }
        throw new Error(
          ` [AI Proxy Critical] T\u1EA5t c\u1EA3 c\xE1c AI Provider/Key d\u1EF1 ph\xF2ng \u0111\u1EC1u s\u1EADp! Error: ${lastError?.message}`
        );
      }
      /**
       * 2. Tạo Vector Embedding có tự động xoay vòng Primary -> Secondary
       */
      static async getEmbeddingWithFallback(text) {
        const textInput = String(text).trim();
        if (!textInput) {
          throw new Error("Text input for embedding cannot be empty");
        }
        let lastError = null;
        for (const provider of this.providers) {
          if (!provider.apiKey) continue;
          try {
            console.log(
              ` [AI Proxy Embedding] \u0110ang t\u1EA1o Vector qua: ${provider.name}...`
            );
            const ai = new GoogleGenAI({ apiKey: provider.apiKey });
            const response = await ai.models.embedContent({
              model: "gemini-embedding-2",
              // hoặc text-embedding-004
              contents: [
                {
                  role: "user",
                  parts: [{ text: textInput }]
                }
              ],
              config: {
                outputDimensionality: 1536
              }
            });
            const embeddingValues = response.embeddings?.[0]?.values ?? [];
            if (embeddingValues.length > 0) {
              return embeddingValues;
            }
          } catch (error) {
            lastError = error;
            console.warn(
              `[AI Proxy Embedding] ${provider.name} g\u1EB7p s\u1EF1 c\u1ED1 (${error.message}). \u0110ang chuy\u1EC3n sang ${provider.name === "Gemini-Primary" ? "GEMINI_SECONDARY_KEY" : "k\u1EBFt th\xFAc"}...`
            );
          }
        }
        throw new Error(
          ` [AI Proxy Critical] Kh\xF4ng th\u1EC3 t\u1EA1o Embedding t\u1EEB c\u1EA3 Primary l\u1EABn Secondary Key! Error: ${lastError?.message}`
        );
      }
    };
  }
});

// Service/aiReconciliationAnalyzer.service.ts
var AIReconciliationAnalyzer;
var init_aiReconciliationAnalyzer_service = __esm({
  "Service/aiReconciliationAnalyzer.service.ts"() {
    init_aiProxy_service();
    AIReconciliationAnalyzer = class {
      /**
       * Đưa dữ liệu đối soát cho Gemini phân tích nguyên nhân gốc & hành vi bất thường
       */
      static async analyzeMismatches(mismatchedAccounts, totalWallets, auditLogsSample) {
        if (mismatchedAccounts.length === 0) {
          return {
            summary: "H\u1EC7 th\u1ED1ng t\xE0i ch\xEDnh \u0111\u1EA1t \u0111\u1ED9 an to\xE0n 100%, kh\xF4ng ph\xE1t hi\u1EC7n b\u1EA5t th\u01B0\u1EDDng.",
            riskLevel: "LOW"
          };
        }
        const prompt = `
[B\xC1O C\xC1O \u0110\u1ED0I SO\xC1T T\xC0I CH\xCDNH C\u1EA6N PH\xC2N T\xCDCH AIOPS]
B\u1EA1n l\xE0 Chuy\xEAn gia Ki\u1EC3m to\xE1n CNTT & An ninh T\xE0i ch\xEDnh (AIOps Security Auditor).
H\xE3y ph\xE2n t\xEDch d\u1EEF li\u1EC7u \u0111\u1ED1i so\xE1t d\u01B0\u1EDBi \u0111\xE2y v\xE0 tr\u1EA3 v\u1EC1 k\u1EBFt qu\u1EA3 d\u01B0\u1EDBi d\u1EA1ng JSON duy nh\u1EA5t.

- T\u1ED5ng s\u1ED1 v\xED ki\u1EC3m tra: ${totalWallets}
- S\u1ED1 v\xED b\u1ECB ch\xEAnh l\u1EC7ch s\u1ED1 d\u01B0: ${mismatchedAccounts.length}
- Danh s\xE1ch ch\xEAnh l\u1EC7ch: ${JSON.stringify(mismatchedAccounts, null, 2)}
- M\u1EABu AuditLog li\xEAn quan: ${JSON.stringify(auditLogsSample, null, 2)}

Y\xCAU C\u1EA6U \u0110\u1EA6U RA (Ch\u1EC9 tr\u1EA3 v\u1EC1 JSON thu\u1EA7n, kh\xF4ng k\xE8m Markdown wrapper \`\`\`json):
{
  "riskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "rootCauseAnalysis": "\u0110\xE1nh gi\xE1 chi ti\u1EBFt nguy\xEAn nh\xE2n g\u1ED1c g\xE2y ra s\u1EF1 ch\xEAnh l\u1EC7ch (V\xED d\u1EE5: do l\u1ED7i tr\xF9ng log, thi\u1EBFu log kh\u1EDFi t\u1EA1o balance, hay c\xF3 d\u1EA5u hi\u1EC7u s\u1EEDa l\xE9n DB)",
  "recommendedAction": "C\xE1c b\u01B0\u1EDBc h\xE0nh \u0111\u1ED9ng khuy\u1EBFn ngh\u1ECB cho Admin",
  "executiveSummary": "T\xF3m t\u1EAFt ng\u1EAFn g\u1ECDn 2 c\xE2u cho Ban gi\xE1m \u0111\u1ED1c"
}
`;
        try {
          const rawAiResponse = await AIProxyService.generateWithFallback(prompt);
          const cleanedJson = rawAiResponse.replace(/```json/g, "").replace(/```/g, "").trim();
          return JSON.parse(cleanedJson);
        } catch (error) {
          console.error("L\u1ED7i ph\xE2n t\xEDch AI \u0110\u1ED1i so\xE1t:", error);
          return {
            riskLevel: "HIGH",
            rootCauseAnalysis: "Kh\xF4ng th\u1EC3 g\u1ECDi AI ph\xE2n t\xEDch do s\u1EF1 c\u1ED1 m\u1EA1ng/proxy.",
            recommendedAction: "Ki\u1EC3m tra th\u1EE7 c\xF4ng danh s\xE1ch m\u1EA3ng mismatchedAccounts.",
            executiveSummary: "Ph\xE1t hi\u1EC7n sai s\u1ED1 t\xE0i ch\xEDnh nh\u01B0ng AI Proxy kh\xF4ng kh\u1EA3 d\u1EE5ng."
          };
        }
      }
    };
  }
});

// Service/reconciliationService.ts
var ReconciliationService;
var init_reconciliationService = __esm({
  "Service/reconciliationService.ts"() {
    init_prismaClient();
    init_aiReconciliationAnalyzer_service();
    ReconciliationService = class {
      static async runDailyReconciliation() {
        console.log(
          "[RECONCILIATION] B\u1EAFt \u0111\u1EA7u ti\u1EBFn tr\xECnh \u0111\u1ED1i so\xE1t & T\u1EF1 \u0111\u1ED9ng ph\u1EE5c h\u1ED3i..."
        );
        const startTime = Date.now();
        const mismatchedAccounts = [];
        let totalWalletsChecked = 0;
        let cursorId = void 0;
        const BATCH_SIZE = 100;
        while (true) {
          const wallets = await prismaClient_default.wallets.findMany({
            take: BATCH_SIZE,
            skip: cursorId ? 1 : 0,
            // Bỏ qua ví đã xử lý ở đợt trước
            cursor: cursorId ? { id: cursorId } : void 0,
            orderBy: { id: "asc" },
            include: { user: { select: { email: true, fullName: true } } }
          });
          if (wallets.length === 0) break;
          cursorId = wallets[wallets.length - 1].id;
          totalWalletsChecked += wallets.length;
          const userIds = wallets.map((w) => w.userId);
          const allAuditLogs = await prismaClient_default.auditLog.findMany({
            where: {
              userId: { in: userIds },
              resource: "Wallets",
              action: {
                notIn: [
                  "SYSTEM_ALERT_BALANCE_MISMATCH",
                  "SYSTEM_AUTO_DEBIT_AND_FREEZE",
                  "ADMIN_UNLOCK_WALLET"
                ]
              }
            },
            orderBy: { createdAt: "asc" }
          });
          const logsByUser = /* @__PURE__ */ new Map();
          for (const log of allAuditLogs) {
            if (!log.userId) continue;
            if (!logsByUser.has(log.userId)) logsByUser.set(log.userId, []);
            logsByUser.get(log.userId).push(log);
          }
          for (const wallet of wallets) {
            const auditLogs = logsByUser.get(wallet.userId) || [];
            let calculatedBalance = 0;
            for (const log of auditLogs) {
              const newData = log.newData;
              if (!newData || typeof newData.amount !== "number") continue;
              const rawAmount = newData.amount;
              const action = log.action.toUpperCase();
              if (rawAmount < 0) {
                calculatedBalance += rawAmount;
              } else {
                if (["TOP_UP", "MASS_GIFT", "REFUND", "CREDIT"].some(
                  (a) => action.includes(a)
                )) {
                  calculatedBalance += rawAmount;
                } else if (["BOOK_TICKET", "REVOKE", "WITHDRAW", "DEBIT"].some(
                  (a) => action.includes(a)
                )) {
                  calculatedBalance -= rawAmount;
                }
              }
            }
            const actualBalance = Number(wallet.balance);
            const difference = Number(
              (actualBalance - calculatedBalance).toFixed(2)
            );
            if (Math.abs(difference) > 1e-3) {
              const isDebt = calculatedBalance < 0;
              mismatchedAccounts.push({
                userId: wallet.userId,
                walletId: wallet.id,
                expectedBalance: calculatedBalance,
                actualBalance,
                difference,
                status: isDebt ? "DEBT_GENERATED_AND_FROZEN" : "DEBITED_AND_FROZEN"
              });
              try {
                await prismaClient_default.$transaction(async (tx) => {
                  await tx.wallets.update({
                    where: { id: wallet.id },
                    data: { balance: calculatedBalance, isLocked: true }
                  });
                  const lastLog = auditLogs[auditLogs.length - 1];
                  if (lastLog?.ipAddress && lastLog.ipAddress !== "127.0.0.1") {
                    await tx.blacklistedIPs.upsert({
                      where: { ipAddress: lastLog.ipAddress },
                      update: {
                        isResolved: false,
                        reason: `Ch\xEAnh l\u1EC7ch t\xE0i ch\xEDnh V\xED #${wallet.id}`
                      },
                      create: {
                        ipAddress: lastLog.ipAddress,
                        userId: wallet.userId,
                        reason: `C\u1EA3nh b\xE1o \u0111\u1ED1i so\xE1t: S\u1ED1 d\u01B0 th\u1EF1c t\u1EBF ${actualBalance}\u0111 vs L\xFD thuy\u1EBFt ${calculatedBalance}\u0111`
                      }
                    });
                  }
                  await tx.auditLog.create({
                    data: {
                      requestId: `AIOPS-RECON-${Date.now()}-${wallet.id}`,
                      userId: wallet.userId,
                      action: "SYSTEM_AUTO_DEBIT_AND_FREEZE",
                      resource: "Wallets",
                      resourceId: wallet.id.toString(),
                      oldData: { actualBalance, isLocked: wallet.isLocked },
                      newData: {
                        adjustedAmount: -difference,
                        newBalance: calculatedBalance,
                        isLocked: true,
                        isDebt,
                        reason: isDebt ? "Kh\u1EA5u tr\u1EEB kho\u1EA3n ti\u1EC1n kh\xF4ng h\u1EE3p l\u1EC7 \u0111\xE3 ti\xEAu x\xE0i -> V\xED ghi n\u1EE3 \xE2m & Kh\xF3a v\xED" : "C\xE2n b\u1EB1ng l\u1EA1i s\u1ED1 d\u01B0 chu\u1EA9n & Kh\xF3a v\xED ch\u1EDD Admin duy\u1EC7t"
                      },
                      ipAddress: "127.0.0.1 (CRON_AIOPS)"
                    }
                  });
                });
              } catch (txError) {
                console.error(
                  `[RECONCILIATION] L\u1ED7i khi x\u1EED l\xFD v\xED ${wallet.id}:`,
                  txError.message
                );
              }
            }
          }
        }
        const duration = Date.now() - startTime;
        let logsSample = [];
        let aiAnalysis = null;
        if (mismatchedAccounts.length > 0) {
          logsSample = await prismaClient_default.auditLog.findMany({
            where: { userId: { in: mismatchedAccounts.map((a) => a.userId) } },
            take: 15,
            orderBy: { createdAt: "desc" }
          });
          try {
            aiAnalysis = await AIReconciliationAnalyzer.analyzeMismatches(
              mismatchedAccounts,
              totalWalletsChecked,
              logsSample
            );
          } catch (aiError) {
            console.error(
              "[RECONCILIATION] L\u1ED7i khi g\u1ECDi AI ph\xE2n t\xEDch:",
              aiError.message
            );
          }
        }
        return {
          success: true,
          totalWalletsChecked,
          mismatchCount: mismatchedAccounts.length,
          mismatchedAccounts,
          durationMs: duration,
          aiAnalysis
        };
      }
    };
  }
});

// jobs/reconciliationJob.ts
var reconciliationJob_exports = {};
__export(reconciliationJob_exports, {
  initReconciliationCron: () => initReconciliationCron
});
import cron from "node-cron";
var isRunning, initReconciliationCron;
var init_reconciliationJob = __esm({
  "jobs/reconciliationJob.ts"() {
    init_reconciliationService();
    isRunning = false;
    initReconciliationCron = () => {
      cron.schedule("0 3 * * *", async () => {
        if (isRunning) {
          console.warn(
            "[CRON RECONCILIATION] Job \u0111ang ch\u1EA1y t\u1EEB tr\u01B0\u1EDBc, b\u1ECF qua l\u01B0\u1EE3t n\xE0y \u0111\u1EC3 tr\xE1nh xung \u0111\u1ED9t!"
          );
          return;
        }
        try {
          isRunning = true;
          console.log(
            "[CRON RECONCILIATION] B\u1EAFt \u0111\u1EA7u ti\u1EBFn tr\xECnh \u0111\u1ED1i so\xE1t t\u1EF1 \u0111\u1ED9ng..."
          );
          const result = await ReconciliationService.runDailyReconciliation();
          console.log(
            `[CRON RECONCILIATION] Ho\xE0n t\u1EA5t. \u0110\xE3 check ${result.totalWalletsChecked} v\xED, ph\xE1t hi\u1EC7n ${result.mismatchCount} l\u1ED7i.`
          );
        } catch (error) {
          console.error(
            "[CRON RECONCILIATION] L\u1ED7i khi ch\u1EA1y Job \u0111\u1ED1i so\xE1t 3h s\xE1ng:",
            error
          );
        } finally {
          isRunning = false;
        }
      });
      console.log("\u0110\xE3 \u0111\u0103ng k\xFD Cron Job \u0111\u1ED1i so\xE1t t\xE0i ch\xEDnh (Ch\u1EA1y l\xFAc 03:00 AM)");
    };
  }
});

// app.ts
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

// config/env.ts
import dotenv from "dotenv";
dotenv.config();
var isVercel = Boolean(process.env.VERCEL);
var isProduction = process.env.NODE_ENV === "production" || isVercel;
var ENV = {
  PORT: Number(process.env.PORT) || 3e3,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8000",
  FRONTEND_URL: isProduction ? process.env.FRONTEND_URL || "https://your-production-domain.com" : "http://localhost:5173"
};

// Middleware/tracingMiddleware.ts
import crypto from "crypto";
var distributedTracing = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
};

// Middleware/errorMiddleware.ts
var globalErrorHandler = (err, req, res, next) => {
  console.error(" [SERVER ERROR]:", err);
  let statusCode = err.statusCode || 500;
  let message = err.message || "\u0110\xE3 c\xF3 l\u1ED7i h\u1EC7 th\u1ED1ng x\u1EA3y ra, vui l\xF2ng th\u1EED l\u1EA1i sau!";
  if (err.code === "P2002") {
    statusCode = 400;
    message = `D\u1EEF li\u1EC7u b\u1ECB tr\xF9ng l\u1EB7p! Tr\u01B0\u1EDDng [${err.meta?.target}] \u0111\xE3 t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng.`;
  }
  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || void 0,
    stack: process.env.NODE_ENV === "development" ? err.stack : void 0
  });
};

// Router/otpRoutes.ts
import { Router } from "express";

// Service/otpService.ts
init_prismaClient();
init_mailQueue();
import crypto2 from "crypto";
var MAX_ATTEMPTS = 5;
var OtpService = class {
  /**
   * Tạo OTP, lưu DB, đẩy job gửi email vào BullMQ.
   * Cooldown 60s chống spam + xóa OTP cũ của cùng email/type.
   */
  static async createOTPLogic(email, type = "REGISTER") {
    const cleanEmail = email.toLowerCase().trim();
    const now = /* @__PURE__ */ new Date();
    const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1e3);
    const standardSpamCheck = await prismaClient_default.oTP.findFirst({
      where: {
        email: cleanEmail,
        type,
        createAt: { gte: oneMinuteAgo }
      }
    });
    if (standardSpamCheck) {
      const error = new Error(
        "Vui l\xF2ng \u0111\u1EE3i 1 ph\xFAt tr\u01B0\u1EDBc khi y\xEAu c\u1EA7u m\xE3 m\u1EDBi!"
      );
      error.statusCode = 429;
      throw error;
    }
    const otpCode = crypto2.randomInt(1e5, 999999).toString();
    const expiredAt = new Date(now.getTime() + 5 * 60 * 1e3);
    await prismaClient_default.oTP.deleteMany({
      where: { email: cleanEmail, type }
    });
    const newOtp = await prismaClient_default.oTP.create({
      data: {
        email: cleanEmail,
        code: otpCode,
        type,
        expiredAt,
        attempts: 0
      }
    });
    try {
      await mailQueue.add(
        "send-otp-job",
        { email: cleanEmail, code: otpCode, type },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2e3 },
          removeOnComplete: true,
          removeOnFail: 100
        }
      );
      console.log(`[QUEUE] \u0110\xE3 \u0111\u1EA9y job g\u1EEDi OTP c\u1EE7a ${cleanEmail} v\xE0o BullMQ`);
    } catch (queueErr) {
      await prismaClient_default.oTP.delete({ where: { id: newOtp.id } }).catch(() => {
      });
      console.error("[QUEUE] \u0110\u1EA9y job th\u1EA5t b\u1EA1i:", queueErr.message);
      const error = new Error(
        "Kh\xF4ng g\u1EEDi \u0111\u01B0\u1EE3c m\xE3 OTP, vui l\xF2ng th\u1EED l\u1EA1i sau \xEDt ph\xFAt!"
      );
      error.statusCode = 503;
      throw error;
    }
    return {
      email: newOtp.email,
      type: newOtp.type,
      expiredAt: newOtp.expiredAt
    };
  }
  /**
   * Verify OTP với giới hạn 5 lần nhập sai (dùng DB attempts).
   * Sai quá 5 lần → xóa OTP, yêu cầu mã mới.
   */
  static async verifyOTPLogic(email, code, type = "REGISTER") {
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();
    const otpRecord = await prismaClient_default.oTP.findFirst({
      where: { email: cleanEmail, type },
      orderBy: { createAt: "desc" }
    });
    if (!otpRecord) {
      const error = new Error("M\xE3 OTP kh\xF4ng ch\xEDnh x\xE1c ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n!");
      error.statusCode = 400;
      throw error;
    }
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await prismaClient_default.oTP.deleteMany({
        where: { email: cleanEmail, type }
      });
      const error = new Error(
        `B\u1EA1n \u0111\xE3 nh\u1EADp sai qu\xE1 ${MAX_ATTEMPTS} l\u1EA7n. Vui l\xF2ng y\xEAu c\u1EA7u m\xE3 OTP m\u1EDBi!`
      );
      error.statusCode = 429;
      throw error;
    }
    if (/* @__PURE__ */ new Date() > otpRecord.expiredAt) {
      const error = new Error("M\xE3 OTP \u0111\xE3 h\u1EBFt h\u1EA1n!");
      error.statusCode = 400;
      throw error;
    }
    if (otpRecord.code !== cleanCode) {
      await prismaClient_default.oTP.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } }
      });
      const remaining = MAX_ATTEMPTS - otpRecord.attempts - 1;
      const error = new Error(
        `M\xE3 OTP kh\xF4ng ch\xEDnh x\xE1c! C\xF2n ${remaining} l\u1EA7n th\u1EED.`
      );
      error.statusCode = 400;
      throw error;
    }
    await prismaClient_default.oTP.deleteMany({
      where: { email: cleanEmail, type }
    });
    return true;
  }
};

// Controller/otpController.ts
var catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
var OtpController = class {
  static sendOTP = catchAsync(async (req, res) => {
    const { email, type } = req.body;
    const otpData = await OtpService.createOTPLogic(email, type || "REGISTER");
    res.status(200).json({
      success: true,
      message: "M\xE3 OTP \u0111\xE3 \u0111\u01B0\u1EE3c g\u1EEDi \u0111\u1EBFn email c\u1EE7a b\u1EA1n.",
      data: {
        email: otpData.email,
        expiredAt: otpData.expiredAt
        // TUYỆT ĐỐI KHÔNG TRẢ CODE VỀ ĐÂY
      }
    });
  });
  static verifyOTP = catchAsync(async (req, res) => {
    const { email, code, type } = req.body;
    await OtpService.verifyOTPLogic(email, code, type || "REGISTER");
    res.status(200).json({
      success: true,
      message: "X\xE1c th\u1EF1c OTP th\xE0nh c\xF4ng!"
    });
  });
};

// Middleware/validateMiddleware.ts
import { ZodError } from "zod";
var AppError = class extends Error {
  statusCode;
  details;
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
};
var validate = (schema) => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      if (parsed.body !== void 0) {
        req.body = parsed.body;
      }
      if (parsed.query !== void 0) {
        for (const key in req.query) delete req.query[key];
        Object.assign(req.query, parsed.query);
      }
      if (parsed.params !== void 0) {
        for (const key in req.params) delete req.params[key];
        Object.assign(req.params, parsed.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issueDetails = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }));
        const errorMessage = issueDetails.map((i) => i.message).join("; ");
        return next(new AppError(errorMessage, 400, issueDetails));
      }
      next(error);
    }
  };
};

// Middleware/ipGuard.ts
init_prismaClient();

// Utils/redisLock.ts
import Redis2 from "ioredis";
import crypto3 from "crypto";
import dotenv3 from "dotenv";
dotenv3.config();
var primaryUrl = process.env.REDIS_URL;
var backupUrl = process.env.REDIS_URL_BACKUP;
if (!primaryUrl) {
  throw new Error("Khai b\xE1o thi\u1EBFu REDIS_URL trong file .env!");
}
var commonRedisOptions = {
  tls: {
    rejectUnauthorized: false
  },
  family: 4,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 1e4,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3e3);
    return delay;
  }
};
var redisPrimary = new Redis2(primaryUrl, commonRedisOptions);
var redisBackup = backupUrl ? new Redis2(backupUrl, commonRedisOptions) : null;
redisPrimary.on("connect", () => {
  console.log("[REDIS PRIMARY]: K\u1EBFt n\u1ED1i Redis Cloud th\xE0nh c\xF4ng!");
});
redisPrimary.on("error", (err) => {
  console.error("[REDIS PRIMARY WARNING]:", err.message);
});
if (redisBackup) {
  redisBackup.on("connect", () => {
    console.log("[REDIS BACKUP]: K\u1EBFt n\u1ED1i Redis Cloud D\u1EF1 Ph\xF2ng s\u1EB5n s\xE0ng!");
  });
  redisBackup.on("error", (err) => {
    console.error("[REDIS BACKUP WARNING]:", err.message);
  });
}
var ACQUIRE_LUA = `
  if redis.call("exists", KEYS[1]) == 1 then return 0 end
  redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
  return 1
`;
var RELEASE_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;
var RedisLock = class {
  /**
   * Danh sách Redis cần ghi lock.
   * Luôn có primary; thêm backup nếu backup đang ready.
   */
  static targets() {
    const list = [redisPrimary];
    if (redisBackup && redisBackup.status === "ready") {
      list.push(redisBackup);
    }
    return list;
  }
  /**
   * Giữ lock ghế trên CẢ primary và backup (write-through).
   * - Primary fail → trả null (không giữ được lock).
   * - Backup conflict (đang có lock khác) → rollback primary, trả null.
   * - Backup lỗi mạng → chấp nhận (backup đang chết, không failover được).
   * TTL mặc định 30s, đủ cho transaction đặt vé.
   */
  static async acquire(key, ttlSeconds = 30) {
    const lockToken = crypto3.randomUUID();
    const clients = this.targets();
    const results = await Promise.allSettled(
      clients.map((c) => c.eval(ACQUIRE_LUA, 1, key, lockToken, ttlSeconds))
    );
    const primaryOk = results[0].status === "fulfilled" && Number(results[0].value) === 1;
    if (!primaryOk) {
      if (clients.length === 2 && results[1].status === "fulfilled" && Number(results[1].value) === 1) {
        await clients[1].eval(RELEASE_LUA, 1, key, lockToken).catch(() => {
        });
      }
      return null;
    }
    if (clients.length === 2) {
      const backupResult = results[1];
      if (backupResult.status === "fulfilled" && Number(backupResult.value) === 0) {
        await clients[0].eval(RELEASE_LUA, 1, key, lockToken).catch(() => {
        });
        console.warn(
          `[REDIS LOCK] Backup \u0111ang gi\u1EEF "${key}" \u2192 rollback primary, tr\u1EA3 null`
        );
        return null;
      }
      if (backupResult.status === "rejected") {
        console.warn(
          `[REDIS LOCK] Backup l\u1ED7i khi acquire "${key}", ch\u1EA5p nh\u1EADn lock ch\u1EC9 tr\xEAn primary`
        );
      }
    }
    return lockToken;
  }
  /**
   * Mở lock ở cả primary và backup (best-effort, xóa song song).
   * Chỉ xóa nếu value khớp token → không xóa nhầm lock của người khác.
   * Trả true nếu ít nhất primary xóa thành công.
   */
  static async release(key, lockToken) {
    const clients = this.targets();
    const results = await Promise.allSettled(
      clients.map((c) => c.eval(RELEASE_LUA, 1, key, lockToken))
    );
    return results[0].status === "fulfilled" && Number(results[0].value) === 1;
  }
};

// Middleware/ipGuard.ts
var checkIpBlacklist = async (req, res, next) => {
  try {
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "127.0.0.1";
    const cacheKey = `ipbl:${clientIp}`;
    let cachedStatus = null;
    try {
      cachedStatus = await redisPrimary.get(cacheKey);
    } catch (redisErr) {
      console.warn("[IP GUARD] Redis l\u1ED7i, fallback xu\u1ED1ng DB:", redisErr);
    }
    if (cachedStatus === "1") {
      return res.status(403).json({
        success: false,
        code: "IP_BLOCKED",
        message: `IP c\u1EE7a b\u1EA1n (${clientIp}) b\u1ECB h\u1EA1n ch\u1EBF \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n m\u1EDBi do li\xEAn quan \u0111\u1EBFn kho\u1EA3n n\u1EE3/vi ph\u1EA1m ch\u01B0a x\u1EED l\xFD.`
      });
    }
    if (cachedStatus === "0") {
      return next();
    }
    const blacklisted = await prismaClient_default.blacklistedIPs.findFirst({
      where: {
        ipAddress: clientIp,
        isResolved: false
      }
    });
    try {
      await redisPrimary.set(cacheKey, blacklisted ? "1" : "0", "EX", 30);
    } catch (redisErr) {
      console.warn("[IP GUARD] Kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c cache IP:", redisErr);
    }
    if (blacklisted) {
      return res.status(403).json({
        success: false,
        code: "IP_BLOCKED",
        message: `IP c\u1EE7a b\u1EA1n (${clientIp}) b\u1ECB h\u1EA1n ch\u1EBF \u0111\u0103ng k\xFD t\xE0i kho\u1EA3n m\u1EDBi do li\xEAn quan \u0111\u1EBFn kho\u1EA3n n\u1EE3/vi ph\u1EA1m ch\u01B0a x\u1EED l\xFD.`
      });
    }
    next();
  } catch (error) {
    console.error("[IP GUARD] L\u1ED7i ki\u1EC3m tra IP:", error);
    next();
  }
};

// Validation/otpValidation.ts
import { z } from "zod";
var ALLOWED_TYPES = ["REGISTER", "FORGOT_PASSWORD"];
var requestOTPSchema = z.object({
  body: z.object({
    email: z.string({ message: "Email kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).trim().email("\u0110\u1ECBnh d\u1EA1ng email kh\xF4ng h\u1EE3p l\u1EC7!"),
    type: z.string().refine((val) => ALLOWED_TYPES.includes(val), {
      message: "Lo\u1EA1i OTP ph\u1EA3i l\xE0 REGISTER ho\u1EB7c FORGOT_PASSWORD!"
    }).optional().default("REGISTER")
  })
});
var verifyOTPSchema = z.object({
  body: z.object({
    email: z.string({ message: "Email kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).trim().email("\u0110\u1ECBnh d\u1EA1ng email kh\xF4ng h\u1EE3p l\u1EC7!"),
    code: z.string({ message: "M\xE3 OTP kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).trim().length(6, "M\xE3 OTP ph\u1EA3i c\xF3 \u0111\xFAng 6 k\xFD t\u1EF1 s\u1ED1!").regex(/^\d+$/, "M\xE3 OTP ch\u1EC9 \u0111\u01B0\u1EE3c ch\u1EE9a k\xFD t\u1EF1 s\u1ED1 (0-9)!"),
    type: z.string().refine((val) => ALLOWED_TYPES.includes(val), {
      message: "Lo\u1EA1i OTP ph\u1EA3i l\xE0 REGISTER ho\u1EB7c FORGOT_PASSWORD!"
    }).optional().default("REGISTER")
  })
});

// Router/otpRoutes.ts
var router = Router();
router.post("/send", checkIpBlacklist, OtpController.sendOTP);
router.post(
  "/verify",
  checkIpBlacklist,
  validate(verifyOTPSchema),
  OtpController.verifyOTP
);
var otpRoutes_default = router;

// Router/tripRoute.ts
import { Router as Router2 } from "express";

// Service/tripService.ts
init_prismaClient();

// Service/cacheService.ts
import { LRUCache } from "lru-cache";
var localCache = new LRUCache({
  max: 500,
  ttl: 1e3 * 10
});
function patternToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}
var MultiLevelCache = class {
  /**
   * Lấy Redis đang sống (Primary → Backup).
   */
  static getActiveRedis() {
    if (redisPrimary.status === "ready" || redisPrimary.status === "connect") {
      return redisPrimary;
    }
    if (redisBackup && (redisBackup.status === "ready" || redisBackup.status === "connect")) {
      console.warn("[CACHE FAILOVER] \u0110ang d\xF9ng Redis Backup cho L2!");
      return redisBackup;
    }
    return null;
  }
  /**
   * Đọc dữ liệu: L1 (RAM) → L2 (Redis) → null (để caller tự query DB).
   * Có log thời gian từng tầng để đo hiệu quả cache.
   */
  static async get(key) {
    const t0 = process.hrtime.bigint();
    if (localCache.has(key)) {
      const ms2 = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(`[CACHE L1] ${key} = ${ms2.toFixed(2)}ms`);
      return localCache.get(key);
    }
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        const redisData = await activeRedis.get(key);
        if (redisData) {
          const parsed = JSON.parse(redisData);
          localCache.set(key, parsed);
          const ms2 = Number(process.hrtime.bigint() - t0) / 1e6;
          console.log(`[CACHE L2] ${key} = ${ms2.toFixed(2)}ms`);
          return parsed;
        }
      } catch (error) {
        console.warn(`[CACHE WARNING] L\u1ED7i \u0111\u1ECDc Redis: ${error.message}`);
      }
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`[CACHE MISS] ${key} = ${ms.toFixed(2)}ms`);
    return null;
  }
  /**
   * Ghi dữ liệu đồng thời vào L1 (RAM) và L2 (Redis).
   */
  static async set(key, value, ttlSeconds = 300) {
    localCache.set(key, value, { ttl: ttlSeconds * 1e3 });
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        await activeRedis.setex(key, ttlSeconds, JSON.stringify(value));
      } catch (error) {
        console.warn(`[CACHE WARNING] L\u1ED7i ghi Redis: ${error.message}`);
      }
    }
  }
  /**
   * Xóa 1 key cụ thể ở cả L1 và L2.
   */
  static async delete(key) {
    localCache.delete(key);
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        await activeRedis.del(key);
      } catch (error) {
        console.warn(`[CACHE WARNING] L\u1ED7i x\xF3a Redis: ${error.message}`);
      }
    }
  }
  /**
   * Xóa cache theo pattern (VD: "trip:123*").
   * Dùng SCAN thay KEYS để không block Redis.
   * Chỉ xóa các key L1 khớp pattern, không xóa toàn bộ.
   */
  static async invalidate(keyPattern) {
    const regex = patternToRegex(keyPattern);
    for (const key of localCache.keys()) {
      if (regex.test(key)) localCache.delete(key);
    }
    const activeRedis = this.getActiveRedis();
    if (!activeRedis) return;
    try {
      let cursor = "0";
      let deletedCount = 0;
      do {
        const [nextCursor, keys] = await activeRedis.scan(
          cursor,
          "MATCH",
          keyPattern,
          "COUNT",
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await activeRedis.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== "0");
      if (deletedCount > 0) {
        console.log(
          `[CACHE INVALIDATE] ${keyPattern} \u2192 x\xF3a ${deletedCount} key L2`
        );
      }
    } catch (error) {
      console.warn(
        `[CACHE WARNING] L\u1ED7i invalidate "${keyPattern}": ${error.message}`
      );
    }
  }
};

// Service/tripService.ts
init_aiProxy_service();
var CACHE_KEYS = {
  ALL_TRIPS: "trips:all:active",
  TRIP_DETAIL: (id) => `trips:detail:${id}`
};
var TripService = class {
  static async getEmbedding(text) {
    return await AIProxyService.getEmbeddingWithFallback(text);
  }
  /**
   * Xóa cache liên quan 1 trip (hoặc toàn bộ nếu không truyền id).
   * Booking/hủy vé gọi hàm này để availableSeats và bookedSeatNumbers luôn tươi.
   */
  static async invalidateTripCaches(tripId) {
    try {
      await MultiLevelCache.invalidate(CACHE_KEYS.ALL_TRIPS);
      if (tripId !== void 0) {
        await MultiLevelCache.invalidate(CACHE_KEYS.TRIP_DETAIL(tripId));
      }
    } catch (cacheErr) {
      console.warn("[TRIP] X\xF3a cache th\u1EA5t b\u1EA1i:", cacheErr.message);
    }
  }
  /**
   * Chuẩn hóa dữ liệu chuyến xe kèm số ghế thực tế.
   */
  static formatTripWithSeats(trip) {
    const activeTickets = trip.tickets || [];
    const bookedSeatNumbers = activeTickets.map((t) => t.seatNumber);
    const totalSeats = trip.totalSeats ?? 30;
    const availableSeats = Math.max(0, totalSeats - bookedSeatNumbers.length);
    return {
      ...trip,
      totalSeats,
      availableSeats,
      bookedSeatNumbers
    };
  }
  /**
   * Tạo chuyến xe mới kèm embedding cho semantic search.
   */
  static async createTripLogic(route, description, departureAt, price, totalSeats) {
    const trimmedRoute = route.trim();
    const trimmedDesc = description ? description.trim() : "";
    const finalSeats = totalSeats && totalSeats > 0 ? totalSeats : 30;
    const textToEmbed = `Chuy\u1EBFn xe tuy\u1EBFn ${trimmedRoute}. Chi ti\u1EBFt m\xF4 t\u1EA3: ${trimmedDesc}`;
    const vector = await this.getEmbedding(textToEmbed);
    const vectorString = `[${vector.join(",")}]`;
    const inserted = await prismaClient_default.$queryRawUnsafe(
      `INSERT INTO "Trips" (route, description, "departureAt", price, "totalSeats", embedding) 
       VALUES ($1, $2, $3, $4, $5, $6::vector) 
       RETURNING id`,
      trimmedRoute,
      trimmedDesc || null,
      new Date(departureAt),
      price,
      finalSeats,
      vectorString
    );
    const createdTrip = await prismaClient_default.trips.findUnique({
      where: { id: inserted[0].id }
    });
    await this.invalidateTripCaches();
    return createdTrip;
  }
  /**
   * Lấy toàn bộ chuyến xe còn hiệu lực, cache 60s.
   */
  static async getAllTripsLogic() {
    const cacheKey = CACHE_KEYS.ALL_TRIPS;
    const cached = await MultiLevelCache.get(cacheKey);
    if (cached) return cached;
    const now = /* @__PURE__ */ new Date();
    const trips = await prismaClient_default.trips.findMany({
      where: { departureAt: { gt: now } },
      orderBy: { departureAt: "asc" },
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true }
        }
      }
    });
    const formatted = trips.map((trip) => this.formatTripWithSeats(trip));
    await MultiLevelCache.set(cacheKey, formatted, 60);
    return formatted;
  }
  /**
   * Lấy chi tiết chuyến xe, cache 10s (ngắn để sơ đồ ghế không stale lâu).
   */
  static async getTripByIdLogic(id) {
    const cacheKey = CACHE_KEYS.TRIP_DETAIL(id);
    const cachedTrip = await MultiLevelCache.get(cacheKey);
    if (cachedTrip) return cachedTrip;
    const trip = await prismaClient_default.trips.findUnique({
      where: { id: Number(id) },
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true, status: true }
        }
      }
    });
    if (!trip) return null;
    const formatted = this.formatTripWithSeats(trip);
    await MultiLevelCache.set(cacheKey, formatted, 10);
    return formatted;
  }
  /**
   * Cập nhật thông tin chuyến xe (Có kiểm tra ràng buộc thời gian và số ghế)
   */
  static async updateTripLogic(id, data) {
    const currentTrip = await prismaClient_default.trips.findUnique({ where: { id } });
    if (!currentTrip) throw new Error("Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe c\u1EA7n c\u1EADp nh\u1EADt!");
    if (new Date(currentTrip.departureAt) < /* @__PURE__ */ new Date()) {
      throw new Error("Kh\xF4ng th\u1EC3 c\u1EADp nh\u1EADt chuy\u1EBFn xe \u0111\xE3 kh\u1EDFi h\xE0nh!");
    }
    if (data.departureAt) {
      const newDeparture = new Date(data.departureAt);
      if (newDeparture < /* @__PURE__ */ new Date()) {
        throw new Error("Ng\xE0y kh\u1EDFi h\xE0nh m\u1EDBi kh\xF4ng \u0111\u01B0\u1EE3c \u1EDF trong qu\xE1 kh\u1EE9!");
      }
    }
    if (data.totalSeats !== void 0) {
      const bookedCount = await prismaClient_default.tickets.count({
        where: {
          tripId: id,
          status: { in: ["HELD", "PENDING", "CONFIRMED"] }
          // Các ghế đang có người giữ
        }
      });
      if (data.totalSeats < bookedCount) {
        throw new Error(
          `Kh\xF4ng th\u1EC3 gi\u1EA3m t\u1ED5ng s\u1ED1 gh\u1EBF xu\u1ED1ng ${data.totalSeats} v\xEC \u0111\xE3 c\xF3 ${bookedCount} gh\u1EBF \u0111\u01B0\u1EE3c kh\xE1ch \u0111\u1EB7t!`
        );
      }
    }
    const finalRoute = data.route ? data.route.trim() : currentTrip.route;
    const finalDesc = data.description !== void 0 ? data.description ? data.description.trim() : "" : currentTrip.description || "";
    const updatedTrip = await prismaClient_default.trips.update({
      where: { id },
      data: {
        ...data.route && { route: data.route.trim() },
        ...data.description !== void 0 && {
          description: data.description ? data.description.trim() : null
        },
        ...data.departureAt && { departureAt: new Date(data.departureAt) },
        ...data.price !== void 0 && { price: Number(data.price) },
        ...data.totalSeats !== void 0 && {
          totalSeats: Number(data.totalSeats)
        }
      }
    });
    if (data.route || data.description !== void 0) {
      const textToEmbed = `Chuy\u1EBFn xe tuy\u1EBFn ${finalRoute}. Chi ti\u1EBFt m\xF4 t\u1EA3: ${finalDesc}`;
      const vector = await this.getEmbedding(textToEmbed);
      const vectorString = `[${vector.join(",")}]`;
      await prismaClient_default.$executeRawUnsafe(
        `UPDATE "Trips" SET embedding = $1::vector WHERE id = $2`,
        vectorString,
        id
      );
    }
    await this.invalidateTripCaches(id);
    return updatedTrip;
  }
  /**
   * Xóa chuyến xe (Chặn xóa chuyến đã chạy)
   */
  static async deleteTripLogic(id) {
    const currentTrip = await prismaClient_default.trips.findUnique({ where: { id } });
    if (!currentTrip) throw new Error("Kh\xF4ng t\xECm th\u1EA5y chuy\u1EBFn xe c\u1EA7n x\xF3a!");
    if (new Date(currentTrip.departureAt) < /* @__PURE__ */ new Date()) {
      throw new Error(
        "Kh\xF4ng th\u1EC3 x\xF3a chuy\u1EBFn xe \u0111\xE3 kh\u1EDFi h\xE0nh \u0111\u1EC3 b\u1EA3o to\xE0n l\u1ECBch s\u1EED!"
      );
    }
    const hasPaidTickets = await prismaClient_default.tickets.findFirst({
      where: { tripId: id, status: "CONFIRMED" }
    });
    if (hasPaidTickets) {
      throw new Error(
        "Kh\xF4ng th\u1EC3 xo\xE1 chuy\u1EBFn xe \u0111\xE3 c\xF3 v\xE9 thanh to\xE1n th\xE0nh c\xF4ng!"
      );
    }
    await prismaClient_default.tickets.deleteMany({ where: { tripId: id } });
    const deletedTrip = await prismaClient_default.trips.delete({ where: { id } });
    await this.invalidateTripCaches(id);
    return deletedTrip;
  }
  static async getAllTripsForAdminLogic() {
    const trips = await prismaClient_default.trips.findMany({
      orderBy: { departureAt: "desc" },
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true }
        }
      }
    });
    return trips.map((trip) => this.formatTripWithSeats(trip));
  }
  /**
   * Tìm chuyến bằng từ khóa (ILIKE) hoặc semantic search (pgvector).
   */
  static async searchTripsSemanticLogic(prompt = "", limit = 10) {
    const safePrompt = typeof prompt === "string" ? prompt : "";
    const cleanPrompt = safePrompt.trim().toLowerCase();
    if (!cleanPrompt || cleanPrompt.includes("t\u1EA5t c\u1EA3") || cleanPrompt.includes("danh s\xE1ch")) {
      return await this.getAllTripsLogic();
    }
    const keywordTrips = await prismaClient_default.trips.findMany({
      where: {
        departureAt: { gt: /* @__PURE__ */ new Date() },
        OR: [
          { route: { contains: cleanPrompt, mode: "insensitive" } },
          { description: { contains: cleanPrompt, mode: "insensitive" } }
        ]
      },
      take: limit,
      orderBy: { departureAt: "asc" },
      include: {
        tickets: {
          where: { status: { in: ["HELD", "PENDING", "CONFIRMED"] } },
          select: { seatNumber: true }
        }
      }
    });
    if (keywordTrips.length > 0) {
      return keywordTrips.map((trip) => this.formatTripWithSeats(trip));
    }
    const queryVector = await this.getEmbedding(cleanPrompt);
    const vectorString = `[${queryVector.join(",")}]`;
    const SIMILARITY_THRESHOLD = 0.85;
    const trips = await prismaClient_default.$queryRaw`
      SELECT id, route, "departureAt", price, "totalSeats", description,
             1 - (embedding <=> ${vectorString}::vector) AS similarity
      FROM "Trips"
      WHERE "departureAt" > NOW()
        AND 1 - (embedding <=> ${vectorString}::vector) > ${SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT ${limit};
    `;
    if (!trips || trips.length === 0) {
      return [];
    }
    const tripIds = trips.map((t) => t.id);
    const activeTickets = await prismaClient_default.tickets.findMany({
      where: {
        tripId: { in: tripIds },
        status: { in: ["HELD", "PENDING", "CONFIRMED"] }
      },
      select: { tripId: true, seatNumber: true }
    });
    return trips.map((trip) => {
      const tripTickets = activeTickets.filter((t) => t.tripId === trip.id);
      const bookedSeatNumbers = tripTickets.map((t) => t.seatNumber);
      const totalSeats = trip.totalSeats ?? 30;
      return {
        ...trip,
        totalSeats,
        availableSeats: Math.max(0, totalSeats - bookedSeatNumbers.length),
        bookedSeatNumbers
      };
    });
  }
};

// Controller/tripController.ts
var catchAsync2 = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
var TripController = class {
  static createTrip = catchAsync2(async (req, res) => {
    const { route, description, departureAt, price, totalSeats } = req.body;
    const tripData = await TripService.createTripLogic(
      route,
      description,
      departureAt,
      price,
      totalSeats
    );
    res.status(201).json({
      success: true,
      message: "T\u1EA1o chuy\u1EBFn xe th\xF4ng minh th\xE0nh c\xF4ng!",
      data: tripData
    });
  });
  static getAllTrips = catchAsync2(async (req, res) => {
    const trips = await TripService.getAllTripsLogic();
    res.status(200).json({ success: true, data: trips });
  });
  static searchSemantic = catchAsync2(async (req, res) => {
    const prompt = req.body?.prompt ?? "";
    const limit = req.body?.limit ? Number(req.body.limit) : 5;
    const searchResults = await TripService.searchTripsSemanticLogic(
      prompt,
      limit
    );
    res.status(200).json({
      success: true,
      message: "T\xECm ki\u1EBFm b\u1EB1ng AI th\xE0nh c\xF4ng!",
      data: searchResults
    });
  });
  static getTripById = catchAsync2(async (req, res) => {
    const id = Number(req.params.id);
    const trip = await TripService.getTripByIdLogic(id);
    res.status(200).json({ success: true, data: trip });
  });
  static updateTrip = catchAsync2(async (req, res) => {
    const id = Number(req.params.id);
    const updatedTrip = await TripService.updateTripLogic(id, req.body);
    res.status(200).json({
      success: true,
      message: "C\u1EADp nh\u1EADt chuy\u1EBFn xe th\xE0nh c\xF4ng!",
      data: updatedTrip
    });
  });
  static deleteTrip = catchAsync2(async (req, res) => {
    const id = Number(req.params.id);
    await TripService.deleteTripLogic(id);
    res.status(200).json({ success: true, message: "X\xF3a chuy\u1EBFn xe th\xE0nh c\xF4ng!" });
  });
  static getAllTripsForAdmin = catchAsync2(
    async (req, res) => {
      const trips = await TripService.getAllTripsForAdminLogic();
      res.status(200).json({ success: true, data: trips });
    }
  );
};

// Middleware/idempotencyMiddleware.ts
var getActiveRedis = () => {
  if (redisPrimary.status === "ready" || redisPrimary.status === "connect") {
    return redisPrimary;
  }
  if (redisBackup && (redisBackup.status === "ready" || redisBackup.status === "connect")) {
    return redisBackup;
  }
  return null;
};
var idempotency = (ttlSeconds = 86400) => {
  return async (req, res, next) => {
    const idempotencyKey = req.headers["x-idempotency-key"];
    if (!idempotencyKey) {
      return next();
    }
    const cacheKey = `idempotency:${idempotencyKey}`;
    const activeRedis = getActiveRedis();
    if (activeRedis) {
      try {
        const cachedResponse = await activeRedis.get(cacheKey);
        if (cachedResponse) {
          const { statusCode, body } = JSON.parse(cachedResponse);
          res.status(statusCode).json(body);
          return;
        }
      } catch (error) {
        console.warn(
          ` [IDEMPOTENCY WARNING] L\u1ED7i \u0111\u1ECDc Redis: ${error.message}`
        );
      }
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const currentRedis = getActiveRedis();
        if (currentRedis) {
          currentRedis.setex(
            cacheKey,
            ttlSeconds,
            JSON.stringify({ statusCode: res.statusCode, body })
          ).catch(
            (err) => console.warn(
              ` [IDEMPOTENCY WARNING] L\u1ED7i ghi Redis: ${err.message}`
            )
          );
        }
      }
      return originalJson(body);
    };
    next();
  };
};
var cacheResponse = (ttlSeconds = 60) => {
  return async (req, res, next) => {
    const cacheKey = `route_cache:${req.originalUrl}`;
    const activeRedis = getActiveRedis();
    if (activeRedis) {
      try {
        const cached = await activeRedis.get(cacheKey);
        if (cached) {
          const { statusCode, body } = JSON.parse(cached);
          return res.status(statusCode).json(body);
        }
      } catch (err) {
      }
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const currentRedis = getActiveRedis();
        if (currentRedis) {
          currentRedis.setex(
            cacheKey,
            ttlSeconds,
            JSON.stringify({ statusCode: res.statusCode, body })
          ).catch(() => {
          });
        }
      }
      return originalJson(body);
    };
    next();
  };
};

// Middleware/authMiddleware.ts
import jwt2 from "jsonwebtoken";

// config/jwt.ts
import dotenv4 from "dotenv";
dotenv4.config();
function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(
      `[CONFIG ERROR] Bi\u1EBFn m\xF4i tr\u01B0\u1EDDng "${name}" ch\u01B0a \u0111\u01B0\u1EE3c khai b\xE1o ho\u1EB7c qu\xE1 ng\u1EAFn (y\xEAu c\u1EA7u >= 32 k\xFD t\u1EF1)!`
    );
  }
  return value;
}
var JWT_SECRET = requiredEnv("JWT_ACCESS_SECRET");
var JWT_REFRESH_SECRET = requiredEnv("JWT_REFRESH_SECRET");

// Service/revocationService.ts
init_prismaClient();
import jwt from "jsonwebtoken";
var RevocationService = class {
  // ============================================================
  // JWT REVOCATION (dùng cho logout + refresh rotation)
  // ============================================================
  /**
   * Đưa jti vào blacklist Redis với TTL = thời gian còn lại của token.
   * Token hết hạn tự nhiên thì không cần lưu (TTL <= 0).
   */
  static async revoke(jti, exp) {
    if (!jti || !exp) return;
    const ttl = exp - Math.floor(Date.now() / 1e3);
    if (ttl <= 0) return;
    try {
      await redisPrimary.set(`revoked:${jti}`, "1", "EX", ttl);
    } catch (err) {
      console.error("[REVOKE] Kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c jti:", err.message);
    }
  }
  /**
   * Kiểm tra jti có nằm trong blacklist không.
   * Redis lỗi thì fail-open (trả false) để không chặn user oan.
   */
  static async isRevoked(jti) {
    if (!jti) return false;
    try {
      return await redisPrimary.get(`revoked:${jti}`) === "1";
    } catch (err) {
      console.error("[REVOKE] Kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c jti:", err.message);
      return false;
    }
  }
  /**
   * Thu hồi cả cặp access + refresh khi logout.
   * Decode lấy jti + exp từng token rồi đưa vào blacklist.
   */
  static async revokePair(accessToken, refreshToken) {
    for (const t of [accessToken, refreshToken]) {
      if (!t) continue;
      try {
        const decoded = jwt.decode(t);
        if (decoded?.jti && decoded?.exp) {
          await this.revoke(decoded.jti, decoded.exp);
        }
      } catch {
      }
    }
  }
  // ============================================================
  // THU HỒI HÀNG LOẠT THEO BATCH ID (sự cố tặng vé/tiền nhầm)
  // ============================================================
  /**
   * Thu hồi toàn bộ tác động của một batch (tặng tiền, cấp vé...).
   * Duyệt từng audit log chưa revoke, hoàn tác theo loại action,
   * ghi log mới để hiển thị lịch sử ví cho user.
   */
  static async revokeBatch(batchId, adminUserId) {
    const cleanBatchId = batchId.trim();
    return await prismaClient_default.$transaction(async (tx) => {
      const logs = await tx.auditLog.findMany({
        where: {
          batchId: { equals: cleanBatchId, mode: "insensitive" },
          isRevoked: false,
          action: { not: "BATCH_REVOKE_EXECUTE" }
        }
      });
      if (!logs || logs.length === 0) {
        throw new Error(
          `Kh\xF4ng t\xECm th\u1EA5y \u0111\u1EE3t t\xE1c \u0111\u1ED9ng "${cleanBatchId}" ho\u1EB7c \u0111\xE3 b\u1ECB thu h\u1ED3i!`
        );
      }
      let revokedUsersCount = 0;
      for (const log of logs) {
        const newDataObj = typeof log.newData === "string" ? JSON.parse(log.newData) : log.newData;
        if (log.action === "MASS_GIFT_EXECUTE") {
          const giftedAmount = Number(newDataObj?.amountPerUser || 0);
          const targetUserIds = newDataObj?.affectedUserIds || [];
          if (giftedAmount > 0 && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
            await tx.wallets.updateMany({
              where: { userId: { in: targetUserIds } },
              data: { balance: { decrement: giftedAmount } }
            });
            const affectedWallets = await tx.wallets.findMany({
              where: { userId: { in: targetUserIds } },
              select: { id: true, userId: true, balance: true }
            });
            const revokeWalletLogs = affectedWallets.map((w) => {
              const currentBalance = Number(w.balance);
              return {
                requestId: `REVOKE_GIFT_${Date.now()}_${w.userId}`,
                userId: w.userId,
                action: "MASS_GIFT_REVOKED",
                batchId: cleanBatchId,
                resource: "Wallets",
                resourceId: String(w.id),
                oldData: { balance: currentBalance + giftedAmount },
                newData: {
                  amount: -giftedAmount,
                  description: `Admin thu h\u1ED3i qu\xE0 t\u1EB7ng ti\u1EC1n v\xED (\u0110\u1EE3t: ${cleanBatchId})`,
                  newBalance: currentBalance
                },
                isRevoked: false
              };
            });
            await tx.auditLog.createMany({
              data: revokeWalletLogs
            });
            revokedUsersCount += targetUserIds.length;
          }
        } else if (log.action === "BOOK_TICKET_PAYMENT" || log.action === "BOOK_TICKET_BATCH" || log.action === "MASS_GIFT_TICKET" || log.resource === "Tickets") {
          const tripId = Number(newDataObj?.tripId);
          const seats = Array.isArray(newDataObj?.seats) ? newDataObj.seats.map((s) => Number(s)) : [];
          const logUserId = log.userId;
          if (tripId && seats.length > 0 && logUserId) {
            const ticketsToRevoke = await tx.tickets.findMany({
              where: {
                tripId,
                seatNumber: { in: seats },
                userId: logUserId,
                status: "CONFIRMED"
              }
            });
            if (ticketsToRevoke.length > 0) {
              const ticketIds = ticketsToRevoke.map((t) => t.id);
              await tx.tickets.updateMany({
                where: { id: { in: ticketIds } },
                data: { status: "REVOKED_BY_ADMIN" }
              });
              try {
                await MultiLevelCache.invalidate(`trips:detail:${tripId}`);
                await MultiLevelCache.invalidate("trips:all:active");
              } catch (cacheErr) {
                console.warn("X\xF3a cache th\u1EA5t b\u1EA1i:", cacheErr);
              }
              const actualPaidAmount = Math.abs(
                Number(newDataObj?.amount || 0)
              );
              if (actualPaidAmount > 0) {
                const updatedWallet = await tx.wallets.update({
                  where: { userId: logUserId },
                  data: { balance: { increment: actualPaidAmount } },
                  select: { id: true, balance: true }
                });
                const currentBalance = Number(updatedWallet.balance);
                await tx.auditLog.create({
                  data: {
                    requestId: `REFUND_${Date.now()}_${logUserId}`,
                    userId: logUserId,
                    action: "REFUND_TICKET_PAYMENT",
                    batchId: cleanBatchId,
                    resource: "Wallets",
                    resourceId: String(updatedWallet.id),
                    oldData: { balance: currentBalance - actualPaidAmount },
                    newData: {
                      amount: actualPaidAmount,
                      description: `Ho\xE0n ti\u1EC1n ${ticketsToRevoke.length} v\xE9 chuy\u1EBFn #${tripId} (Thu h\u1ED3i \u0111\u1EE3t l\u1ED7i h\u1EC7 th\u1ED1ng)`,
                      newBalance: currentBalance,
                      tripId,
                      seats
                    },
                    isRevoked: false
                  }
                });
              }
              revokedUsersCount += ticketsToRevoke.length;
            }
          }
        }
        await tx.auditLog.update({
          where: { id: log.id },
          data: { isRevoked: true }
        });
      }
      await tx.auditLog.create({
        data: {
          requestId: `REVOKE_SUMMARY_${Date.now()}`,
          userId: adminUserId,
          action: "BATCH_REVOKE_EXECUTE",
          batchId: cleanBatchId,
          resource: "System",
          resourceId: cleanBatchId,
          newData: { revokedTotal: revokedUsersCount }
        }
      });
      return { success: true, revokedCount: revokedUsersCount };
    });
  }
};

// Middleware/authMiddleware.ts
var authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access Token kh\xF4ng \u0111\u01B0\u1EE3c cung c\u1EA5p!"
    });
  }
  try {
    const decoded = jwt2.verify(token, JWT_SECRET);
    if (decoded.type !== "access") {
      return res.status(401).json({
        success: false,
        message: "Sai lo\u1EA1i token. Vui l\xF2ng s\u1EED d\u1EE5ng Access Token!"
      });
    }
    const isRevoked = await RevocationService.isRevoked(decoded.jti);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        message: "Phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 k\u1EBFt th\xFAc ho\u1EB7c token b\u1ECB thu h\u1ED3i!"
      });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.log("\u274C L\u1ED6I VERIFY JWT:", err.message);
    return res.status(401).json({
      success: false,
      message: "Token kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n!"
    });
  }
};
var requireAdmin = (req, res, next) => {
  const user = req.user;
  if (user?.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Quy\u1EC1n truy c\u1EADp b\u1ECB t\u1EEB ch\u1ED1i. B\u1EAFt bu\u1ED9c l\xE0 T\xE0i kho\u1EA3n Admin!"
    });
  }
  next();
};

// Validation/tripValidation.ts
import { z as z2 } from "zod";
var createTripSchema = z2.object({
  body: z2.object({
    route: z2.string({ message: "Tuy\u1EBFn \u0111\u01B0\u1EDDng kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).min(5, "Tuy\u1EBFn \u0111\u01B0\u1EDDng ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 5 k\xFD t\u1EF1!"),
    description: z2.string().max(500, "M\xF4 t\u1EA3 kh\xF4ng \u0111\u01B0\u1EE3c v\u01B0\u1EE3t qu\xE1 500 k\xFD t\u1EF1!").optional(),
    departureAt: z2.string({ message: "Th\u1EDDi gian kh\u1EDFi h\xE0nh kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).datetime({
      message: "Th\u1EDDi gian kh\u1EDFi h\xE0nh ph\u1EA3i \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng ISO DateTime (VD: 2026-07-17T15:00:00.000Z)!"
    }),
    price: z2.number({ message: "Gi\xE1 v\xE9 ph\u1EA3i l\xE0 s\u1ED1!" }).positive("Gi\xE1 v\xE9 ph\u1EA3i l\xE0 m\u1ED9t s\u1ED1 d\u01B0\u01A1ng l\u1EDBn h\u01A1n 0!"),
    totalSeats: z2.number({ message: "S\u1ED1 l\u01B0\u1EE3ng gh\u1EBF ph\u1EA3i l\xE0 s\u1ED1!" }).int("S\u1ED1 l\u01B0\u1EE3ng gh\u1EBF ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn!").positive("S\u1ED1 l\u01B0\u1EE3ng gh\u1EBF ph\u1EA3i l\u1EDBn h\u01A1n 0!").optional()
  })
});
var updateTripSchema = z2.object({
  params: z2.object({
    id: z2.coerce.number({ message: "Trip ID ph\u1EA3i l\xE0 s\u1ED1!" }).positive("Trip ID ph\u1EA3i l\u1EDBn h\u01A1n 0!")
  }),
  body: createTripSchema.shape.body.partial().refine((data) => Object.keys(data).length > 0, {
    message: "Vui l\xF2ng cung c\u1EA5p \xEDt nh\u1EA5t m\u1ED9t tr\u01B0\u1EDDng d\u1EEF li\u1EC7u c\u1EA7n c\u1EADp nh\u1EADt (route, description, price,...)!"
  })
});
var getTripParamSchema = z2.object({
  params: z2.object({
    id: z2.coerce.number({ message: "Trip ID ph\u1EA3i l\xE0 s\u1ED1!" }).positive("Trip ID ph\u1EA3i l\u1EDBn h\u01A1n 0!")
  })
});
var searchAiSchema = z2.object({
  body: z2.object({
    // Đảm bảo nhận prompt từ body, nếu không truyền thì default = ""
    prompt: z2.string().optional().default(""),
    // Coerce limit nếu client truyền lên số dạng string hoặc không truyền
    limit: z2.coerce.number().positive("Limit ph\u1EA3i l\xE0 s\u1ED1 d\u01B0\u01A1ng l\u1EDBn h\u01A1n 0!").optional().default(5)
  })
});

// Router/tripRoute.ts
var router2 = Router2();
router2.get("/", cacheResponse(60), TripController.getAllTrips);
router2.post(
  "/semantic-search",
  validate(searchAiSchema),
  TripController.searchSemantic
);
router2.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  TripController.getAllTripsForAdmin
);
router2.post(
  "/",
  authenticateToken,
  requireAdmin,
  validate(createTripSchema),
  TripController.createTrip
);
router2.patch(
  "/:id",
  authenticateToken,
  requireAdmin,
  validate(updateTripSchema),
  TripController.updateTrip
);
router2.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  validate(getTripParamSchema),
  TripController.deleteTrip
);
router2.get("/:id", validate(getTripParamSchema), TripController.getTripById);
var tripRoute_default = router2;

// Router/userRoutes.ts
import { Router as Router3 } from "express";

// Service/userService.ts
init_prismaClient();
import bcrypt from "bcryptjs";

// Service/cloudinaryService.ts
import { v2 as cloudinary } from "cloudinary";

// config/cloudinary.ts
import dotenv5 from "dotenv";
dotenv5.config();
function requiredEnv2(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[CONFIG ERROR] Thi\u1EBFu bi\u1EBFn m\xF4i tr\u01B0\u1EDDng "${name}" cho Cloudinary!`
    );
  }
  return value;
}
var cloudinaryPrimaryConfig = {
  cloud_name: requiredEnv2("CLOUDINARY_CLOUD_NAME"),
  api_key: requiredEnv2("CLOUDINARY_API_KEY"),
  api_secret: requiredEnv2("CLOUDINARY_API_SECRET"),
  secure: true
};
var cloudinaryBackupConfig = process.env.CLOUDINARY_CLOUD_NAME_BACKUP && process.env.CLOUDINARY_API_KEY_BACKUP && process.env.CLOUDINARY_API_SECRET_BACKUP ? {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME_BACKUP,
  api_key: process.env.CLOUDINARY_API_KEY_BACKUP,
  api_secret: process.env.CLOUDINARY_API_SECRET_BACKUP,
  secure: true
} : cloudinaryPrimaryConfig;
console.log(
  "[CLOUDINARY] \u0110\xE3 n\u1EA1p c\u1EA5u h\xECnh Primary:",
  cloudinaryPrimaryConfig.cloud_name
);
if (cloudinaryBackupConfig !== cloudinaryPrimaryConfig) {
  console.log(
    "[CLOUDINARY] \u0110\xE3 n\u1EA1p c\u1EA5u h\xECnh Backup:",
    cloudinaryBackupConfig.cloud_name
  );
} else {
  console.warn(
    "[CLOUDINARY] C\u1EA3nh b\xE1o: Kh\xF4ng c\xF3 c\u1EA5u h\xECnh Backup, d\xF9ng chung bucket Primary."
  );
}

// Service/cloudinaryService.ts
init_prismaClient();
import { Readable } from "stream";
var CloudinaryService = class {
  /**
   * Helper: Upload lên 1 bucket cụ thể bằng cách tiêm (inject) config vào options
   * Việc này giúp tránh hoàn toàn lỗi ghi đè singleton của thư viện Cloudinary.
   */
  static uploadToBucket(config, fileBuffer, userId) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          ...config,
          // Bơm credentials (cloud_name, api_key...) trực tiếp vào đây
          folder: "nexus_ticket/avatars",
          public_id: `user_${userId}`,
          overwrite: true,
          transformation: [
            { width: 250, height: 250, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" }
          ]
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("L\u1ED7i upload \u1EA3nh l\xEAn Cloudinary!"));
          }
          resolve(result.secure_url);
        }
      );
      Readable.from(fileBuffer).pipe(uploadStream);
    });
  }
  /**
   * Upload Avatar Stream với cơ chế Retry (Primary) và Auto-Failover (Backup)
   */
  static async uploadAvatarStream(fileBuffer, userId) {
    let lastPrimaryError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.uploadToBucket(
          cloudinaryPrimaryConfig,
          fileBuffer,
          userId
        );
      } catch (e) {
        lastPrimaryError = e;
        console.warn(
          `[CLOUDINARY] Primary l\u1ED7i l\u1EA7n ${attempt + 1}/3: ${e.message}`
        );
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      }
    }
    console.warn(
      `[CLOUDINARY WARNING] Primary s\u1EADp ho\xE0n to\xE0n. Chuy\u1EC3n sang Backup...`
    );
    try {
      return await this.uploadToBucket(
        cloudinaryBackupConfig,
        fileBuffer,
        userId
      );
    } catch (backupError) {
      console.error(
        "[CLOUDINARY CRITICAL] C\u1EA3 2 t\xE0i kho\u1EA3n Cloudinary \u0111\u1EC1u th\u1EA5t b\u1EA1i!"
      );
      throw new Error(
        `Kh\xF4ng th\u1EC3 upload avatar: Primary=${lastPrimaryError?.message}, Backup=${backupError.message}`
      );
    }
  }
  /**
   * Cập nhật Avatar vào DB và tự động dọn dẹp ảnh cũ trên Cloudinary
   */
  static async updateAvatar(userId, fileBuffer) {
    const oldUser = await prismaClient_default.users.findUnique({
      where: { id: userId },
      select: { avatarUrl: true }
    });
    const newAvatarUrl = await this.uploadAvatarStream(fileBuffer, userId);
    const updatedUser = await prismaClient_default.users.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true
      }
    });
    if (oldUser?.avatarUrl && oldUser.avatarUrl !== newAvatarUrl) {
      try {
        const match = oldUser.avatarUrl.match(/\/v\d+\/(.+)\.[a-z]+$/i);
        if (match && match[1]) {
          const currentConfig = cloudinary.config();
          cloudinary.config(cloudinaryPrimaryConfig);
          await cloudinary.uploader.destroy(match[1]);
          cloudinary.config(currentConfig);
          console.log(`[CLOUDINARY] \u0110\xE3 d\u1ECDn d\u1EB9p \u1EA3nh c\u0169 c\u1EE7a user ${userId}`);
        }
      } catch (err) {
        console.error("[CLOUDINARY] Kh\xF4ng x\xF3a \u0111\u01B0\u1EE3c \u1EA3nh c\u0169:", err.message);
      }
    }
    return updatedUser;
  }
};

// Service/userService.ts
var UserService = class {
  static async registerUser(data) {
    const cleanEmail = data.email.toLowerCase().trim();
    const existingUser = await prismaClient_default.users.findUnique({
      where: { email: cleanEmail }
    });
    if (existingUser) {
      const error = new Error("Email n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD s\u1EED d\u1EE5ng!");
      error.statusCode = 400;
      throw error;
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return await prismaClient_default.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          email: cleanEmail,
          password: hashedPassword,
          fullName: data.fullName,
          role: "CUSTOMER",
          // Đảm bảo role mặc định
          wallet: {
            create: {
              balance: 0
            }
          }
        },
        include: {
          wallet: true
        }
      });
      const { password, ...userWithoutPassword } = newUser;
      return userWithoutPassword;
    });
  }
  // Hàm lấy profile của bất kỳ ai (Công khai)
  static async getUserById(userId) {
    const user = await prismaClient_default.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true
        // BẢO MẬT: Tuyệt đối không trả về email, role, hay wallet ở đây
      }
    });
    if (!user) {
      const error = new Error("Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng!");
      error.statusCode = 404;
      throw error;
    }
    return user;
  }
  // Hàm lấy profile của chính mình (Cần token)
  static async getProfile(userId) {
    const user = await prismaClient_default.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        // Thêm avatarUrl để FE hiển thị
        createdAt: true,
        wallet: {
          select: {
            balance: true,
            isLocked: true
          }
        }
      }
    });
    if (!user) {
      const error = new Error("Kh\xF4ng t\xECm th\u1EA5y th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng!");
      error.statusCode = 404;
      throw error;
    }
    return user;
  }
  static async updateAvatar(userId, fileBuffer) {
    return await CloudinaryService.updateAvatar(userId, fileBuffer);
  }
};

// Controller/userController.ts
var UserController = class {
  static async register(req, res, next) {
    try {
      const user = await UserService.registerUser(req.body);
      res.status(201).json({
        success: true,
        message: "T\u1EA1o t\xE0i kho\u1EA3n v\xE0 kh\u1EDFi t\u1EA1o v\xED th\xE0nh c\xF4ng!",
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
  static async getUserProfile(req, res, next) {
    try {
      const userId = Number(req.params.id);
      const user = await UserService.getUserById(userId);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
  static getMe = async (req, res, next) => {
    try {
      const user = req.user;
      const userId = user?.id || user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Phi\xEAn l\xE0m vi\u1EC7c h\u1EBFt h\u1EA1n ho\u1EB7c kh\xF4ng t\xECm th\u1EA5y th\xF4ng tin ng\u01B0\u1EDDi d\xF9ng!"
        });
      }
      const userProfile = await UserService.getProfile(Number(userId));
      res.status(200).json({
        success: true,
        data: userProfile
      });
    } catch (error) {
      next(error);
    }
  };
  static async updateAvatar(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Vui l\xF2ng ch\u1ECDn 1 file \u1EA3nh!" });
      }
      const updatedUser = await UserService.updateAvatar(
        Number(userId),
        req.file.buffer
      );
      return res.status(200).json({
        success: true,
        message: "C\u1EADp nh\u1EADt \u1EA3nh \u0111\u1EA1i di\u1EC7n th\xE0nh c\xF4ng!",
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  }
};

// Middleware/upload.ts
import multer from "multer";
var storage = multer.memoryStorage();
var uploadSingleImage = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  // Giới hạn 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Ch\u1EC9 ch\u1EA5p nh\u1EADn file h\xECnh \u1EA3nh!"));
    }
  }
}).single("avatar");

// Validation/userValidation.ts
import { z as z3 } from "zod";
var registerUserSchema = z3.object({
  body: z3.object({
    email: z3.string({ message: "Email kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).email("\u0110\u1ECBnh d\u1EA1ng email kh\xF4ng h\u1EE3p l\u1EC7!"),
    password: z3.string({ message: "M\u1EADt kh\u1EA9u kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).min(6, "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 6 k\xFD t\u1EF1!"),
    fullName: z3.string({ message: "H\u1ECD v\xE0 t\xEAn kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).min(2, "H\u1ECD v\xE0 t\xEAn ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 2 k\xFD t\u1EF1!")
  })
});
var getUserParamSchema = z3.object({
  params: z3.object({
    id: z3.coerce.number({ message: "User ID ph\u1EA3i l\xE0 s\u1ED1!" }).positive("User ID ph\u1EA3i l\u1EDBn h\u01A1n 0!")
  })
});

// Router/userRoutes.ts
var router3 = Router3();
router3.post("/register", validate(registerUserSchema), UserController.register);
router3.get("/me", authenticateToken, UserController.getMe);
router3.get("/:id", validate(getUserParamSchema), UserController.getUserProfile);
router3.patch(
  "/avatar",
  authenticateToken,
  uploadSingleImage,
  UserController.updateAvatar
);
var userRoutes_default = router3;

// Router/walletRoutes.ts
import { Router as Router4 } from "express";

// Service/walletService.ts
init_prismaClient();
var WalletService = class {
  static async getBalance(userId) {
    const wallet = await prismaClient_default.wallets.findUnique({
      where: { userId }
    });
    if (!wallet) {
      const error = new Error("Kh\xF4ng t\xECm th\u1EA5y v\xED c\u1EE7a ng\u01B0\u1EDDi d\xF9ng n\xE0y!");
      error.statusCode = 404;
      throw error;
    }
    return wallet;
  }
  static async topUp(userId, amount, options) {
    if (amount <= 0) {
      const error = new Error("S\u1ED1 ti\u1EC1n n\u1EA1p ph\u1EA3i l\u1EDBn h\u01A1n 0!");
      error.statusCode = 400;
      throw error;
    }
    return await prismaClient_default.$transaction(async (tx) => {
      const wallet = await tx.wallets.findUnique({
        where: { userId }
      });
      if (!wallet) {
        const error = new Error("Kh\xF4ng t\xECm th\u1EA5y v\xED c\u1EE7a ng\u01B0\u1EDDi d\xF9ng n\xE0y!");
        error.statusCode = 404;
        throw error;
      }
      if (wallet.isLocked) {
        const error = new Error(
          "V\xED n\xE0y \u0111ang b\u1ECB kh\xF3a do vi ph\u1EA1m ho\u1EB7c ch\u1EDD \u0111\u1ED1i so\xE1t. Kh\xF4ng th\u1EC3 n\u1EA1p ti\u1EC1n!"
        );
        error.statusCode = 403;
        throw error;
      }
      const updatedWallet = await tx.wallets.update({
        where: { userId },
        data: {
          balance: {
            increment: amount
          }
        }
      });
      await tx.auditLog.create({
        data: {
          requestId: options?.requestId || `TOPUP_${Date.now()}`,
          userId,
          action: options?.action || "TOP_UP",
          batchId: options?.batchId || null,
          resource: "Wallets",
          resourceId: String(updatedWallet.id),
          oldData: { balance: wallet.balance },
          newData: {
            amount,
            giftAmount: amount,
            description: `N\u1EA1p ti\u1EC1n v\xE0o v\xED: +${amount.toLocaleString("vi-VN")} VN\u0110`,
            newBalance: updatedWallet.balance
          },
          ipAddress: options?.ipAddress || null
        }
      });
      return updatedWallet;
    });
  }
  static async getWalletTransactions(userId, params = {}) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;
    const wallet = await prismaClient_default.wallets.findUnique({
      where: { userId }
    });
    const walletIdStr = wallet ? String(wallet.id) : null;
    const currentBalance = wallet ? Number(wallet.balance) : 0;
    if (!walletIdStr) {
      return {
        currentBalance: 0,
        transactions: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      };
    }
    const whereCondition = {
      OR: [
        {
          userId,
          action: {
            in: [
              "TOP_UP",
              "BOOK_TICKET_PAYMENT",
              "CANCEL_TICKET_REFUND",
              "SYSTEM_GIFT_BALANCE",
              "MASS_GIFT_RECEIVED",
              "MASS_GIFT_REVOKED",
              "REFUND_TICKET_PAYMENT"
            ]
          }
        },
        {
          resource: "Wallets",
          resourceId: walletIdStr,
          action: {
            in: [
              "MASS_GIFT_WALLET",
              "MASS_GIFT_RECEIVED",
              "MASS_GIFT_REVOKED",
              "REVOKE_MASS_GIFT",
              "REVOKE_BATCH",
              "ADMIN_ADJUST_BALANCE",
              "REFUND_TICKET_PAYMENT"
            ]
          }
        }
      ]
    };
    const [transactions, total] = await prismaClient_default.$transaction([
      prismaClient_default.auditLog.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prismaClient_default.auditLog.count({
        where: whereCondition
      })
    ]);
    return {
      currentBalance,
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
};

// Controller/walletController.ts
var catchAsync3 = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
var WalletController = class {
  static topUp = catchAsync3(async (req, res) => {
    const userId = Number(req.params.userId);
    const { amount, batchId, action } = req.body;
    const wallet = await WalletService.topUp(userId, Number(amount), {
      requestId: req.requestId,
      batchId,
      action,
      ipAddress: req.ip
    });
    res.status(200).json({
      success: true,
      message: "N\u1EA1p ti\u1EC1n v\xE0o v\xED th\xE0nh c\xF4ng!",
      data: wallet
    });
  });
  static getBalance = catchAsync3(async (req, res) => {
    const userIdFromToken = req.user?.id || req.user?.userId;
    const role = req.user?.role;
    let targetUserId = Number(userIdFromToken);
    if (role === "ADMIN" && req.params.userId) {
      targetUserId = Number(req.params.userId);
    }
    const wallet = await WalletService.getBalance(targetUserId);
    res.status(200).json({ success: true, data: wallet });
  });
  static getTransactions = catchAsync3(async (req, res) => {
    const userIdFromToken = req.user?.id || req.user?.userId;
    const role = req.user?.role;
    let targetUserId = Number(userIdFromToken);
    if (role === "ADMIN" && req.params.userId) {
      targetUserId = Number(req.params.userId);
    }
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await WalletService.getWalletTransactions(targetUserId, {
      page,
      limit
    });
    res.status(200).json({ success: true, data: result });
  });
};

// Validation/walletValidation.ts
import { z as z4 } from "zod";
var topUpWalletSchema = z4.object({
  params: z4.object({
    userId: z4.coerce.number({ message: "User ID ph\u1EA3i l\xE0 s\u1ED1!" }).positive("User ID ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn d\u01B0\u01A1ng l\u1EDBn h\u01A1n 0!")
  }),
  body: z4.object({
    amount: z4.number({ message: "S\u1ED1 ti\u1EC1n n\u1EA1p kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng v\xE0 ph\u1EA3i l\xE0 s\u1ED1!" }).positive("S\u1ED1 ti\u1EC1n n\u1EA1p v\xE0o v\xED ph\u1EA3i l\u1EDBn h\u01A1n 0!"),
    //  BỔ SUNG 2 TRƯỜNG NÀY ĐỂ ZOD KHÔNG CẮT BỎ DỮ LIỆU LOG
    batchId: z4.string().optional().nullable(),
    action: z4.string().optional().nullable()
  })
});
var getUserWalletSchema = z4.object({
  params: z4.object({
    userId: z4.coerce.number({ message: "User ID ph\u1EA3i l\xE0 s\u1ED1!" }).positive("User ID ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn d\u01B0\u01A1ng l\u1EDBn h\u01A1n 0!")
  })
});
var getWalletTransactionsSchema = z4.object({
  params: z4.object({
    userId: z4.string().transform((val) => Number(val))
  }),
  query: z4.object({
    page: z4.string().optional(),
    limit: z4.string().optional()
  })
});

// Router/walletRoutes.ts
var router4 = Router4();
router4.post(
  "/:userId/topup",
  authenticateToken,
  requireAdmin,
  idempotency(86400),
  validate(topUpWalletSchema),
  WalletController.topUp
);
router4.get(
  "/:userId",
  authenticateToken,
  validate(getUserWalletSchema),
  WalletController.getBalance
);
router4.get(
  "/:userId/transactions",
  authenticateToken,
  validate(getWalletTransactionsSchema),
  WalletController.getTransactions
);
var walletRoutes_default = router4;

// Router/adminRoutes.ts
import { Router as Router5 } from "express";

// Service/adminService.ts
init_prismaClient();
import { v2 as cloudinary2 } from "cloudinary";
import { GoogleGenerativeAI as GoogleGenerativeAI2 } from "@google/generative-ai";
var AdminService = class {
  /**
   * Lấy số liệu thống kê tổng quan hệ thống cho Admin Dashboard
   */
  static async getSystemStats() {
    const totalUsers = await prismaClient_default.users.count({
      where: { role: "CUSTOMER" }
    });
    const totalTrips = await prismaClient_default.trips.count();
    const totalTicketsSold = await prismaClient_default.tickets.count({
      where: { status: "CONFIRMED" }
    });
    const confirmedTickets = await prismaClient_default.tickets.findMany({
      where: { status: "CONFIRMED" },
      select: {
        createdAt: true,
        trip: {
          select: { price: true, route: true }
        }
      }
    });
    const totalRevenue = confirmedTickets.reduce((sum, ticket) => {
      return sum + Number(ticket.trip?.price || 0);
    }, 0);
    const walletBalanceSum = await prismaClient_default.wallets.aggregate({
      _sum: { balance: true }
    });
    const routeMap = {};
    confirmedTickets.forEach((ticket) => {
      const routeName = ticket.trip?.route || "Kh\xF4ng x\xE1c \u0111\u1ECBnh";
      routeMap[routeName] = (routeMap[routeName] || 0) + 1;
    });
    const topRoutes = Object.entries(routeMap).map(([name, tickets]) => ({ name, tickets })).sort((a, b) => b.tickets - a.tickets).slice(0, 5);
    const sevenDaysAgo = /* @__PURE__ */ new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const revenueChartMap = /* @__PURE__ */ new Map();
    for (let i = 6; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit"
      });
      revenueChartMap.set(dateStr, 0);
    }
    confirmedTickets.forEach((ticket) => {
      if (ticket.createdAt >= sevenDaysAgo) {
        const dateStr = new Date(ticket.createdAt).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit"
        });
        if (revenueChartMap.has(dateStr)) {
          const current = revenueChartMap.get(dateStr) || 0;
          revenueChartMap.set(
            dateStr,
            current + Number(ticket.trip?.price || 0)
          );
        }
      }
    });
    const revenueChart = Array.from(revenueChartMap.entries()).map(
      ([date, amount]) => ({
        date,
        amount
      })
    );
    return {
      totalRevenue,
      totalUsers,
      totalTrips,
      totalTicketsSold,
      totalSystemWalletBalance: Number(walletBalanceSum._sum.balance || 0),
      topRoutes,
      revenueChart
    };
  }
  static async getAllUsers(params) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;
    const whereCondition = params.search ? {
      OR: [
        {
          fullName: {
            contains: params.search,
            mode: "insensitive"
          }
        },
        {
          email: { contains: params.search, mode: "insensitive" }
        }
      ]
    } : {};
    const [users, total] = await prismaClient_default.$transaction([
      prismaClient_default.users.findMany({
        where: whereCondition,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          wallet: {
            select: {
              balance: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prismaClient_default.users.count({ where: whereCondition })
    ]);
    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
  static async executeMassGift(data) {
    let targetUsers = [];
    if (data.targetType === "SINGLE" && data.targetId) {
      const singleUser = await prismaClient_default.users.findUnique({
        where: { id: Number(data.targetId) },
        select: { id: true, wallet: { select: { id: true, balance: true } } }
      });
      if (singleUser) targetUsers = [singleUser];
    } else {
      targetUsers = await prismaClient_default.users.findMany({
        where: { role: "CUSTOMER" },
        select: { id: true, wallet: { select: { id: true, balance: true } } }
      });
    }
    const validUsers = targetUsers.filter((u) => u.wallet !== null);
    const targetUserIds = validUsers.map((u) => u.id);
    if (targetUserIds.length === 0) {
      const error = new Error(
        "Kh\xF4ng t\xECm th\u1EA5y ng\u01B0\u1EDDi d\xF9ng h\u1EE3p l\u1EC7 \u0111\u1EC3 t\u1EB7ng qu\xE0!"
      );
      error.statusCode = 400;
      throw error;
    }
    const finalBatchId = data.batchId?.trim() || `MASS_GIFT_${Date.now()}`;
    const requestId = `REQ_${Date.now()}`;
    const totalSpent = data.amount * targetUserIds.length;
    return await prismaClient_default.$transaction(async (tx) => {
      await tx.wallets.updateMany({
        where: { userId: { in: targetUserIds } },
        data: {
          balance: {
            increment: data.amount
          }
        }
      });
      const userAuditLogs = validUsers.map((u) => {
        const oldBalance = Number(u.wallet.balance);
        const newBalance = oldBalance + data.amount;
        return {
          requestId,
          userId: u.id,
          action: "MASS_GIFT_RECEIVED",
          batchId: finalBatchId,
          resource: "Wallets",
          resourceId: String(u.wallet.id),
          oldData: { balance: oldBalance },
          newData: {
            amount: data.amount,
            giftAmount: data.amount,
            description: `Nh\u1EADn qu\xE0 t\u1EB7ng t\u1EEB Admin: +${data.amount.toLocaleString("vi-VN")} VN\u0110 (L\xFD do: ${data.reason})`,
            newBalance,
            reason: data.reason
          },
          ipAddress: null,
          isRevoked: false
        };
      });
      const CHUNK_SIZE = 1e3;
      for (let i = 0; i < userAuditLogs.length; i += CHUNK_SIZE) {
        const chunk = userAuditLogs.slice(i, i + CHUNK_SIZE);
        await tx.auditLog.createMany({
          data: chunk
        });
      }
      await tx.auditLog.create({
        data: {
          requestId,
          userId: data.adminUserId,
          action: "MASS_GIFT_EXECUTE",
          batchId: finalBatchId,
          resource: "System",
          resourceId: finalBatchId,
          newData: {
            targetType: data.targetType || "ALL",
            totalUsersGifted: targetUserIds.length,
            amountPerUser: data.amount,
            totalAmountSpent: totalSpent,
            reason: data.reason,
            affectedUserIds: targetUserIds
          },
          isRevoked: false
        }
      });
      return {
        batchId: finalBatchId,
        totalUsersGifted: targetUserIds.length,
        amountPerUser: data.amount,
        totalAmountSpent: totalSpent
      };
    });
  }
  static async getAuditLogs(params) {
    const page = params.page || 1;
    const limit = params.limit || 15;
    const skip = (page - 1) * limit;
    const whereCondition = {};
    if (params.batchId) {
      whereCondition.batchId = params.batchId;
    }
    if (params.action) {
      whereCondition.action = params.action;
    }
    if (params.userId) {
      whereCondition.userId = params.userId;
    }
    if (!params.userId && !params.action) {
      whereCondition.action = {
        notIn: ["MASS_GIFT_RECEIVED", "MASS_GIFT_REVOKED"]
      };
    }
    const [logs, total] = await prismaClient_default.$transaction([
      prismaClient_default.auditLog.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prismaClient_default.auditLog.count({ where: whereCondition })
    ]);
    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
  static async getHealthStatus() {
    const startTime = Date.now();
    let dbLatency = "N/A";
    let dbStatus = "HEALTHY";
    try {
      const dbStart = Date.now();
      await prismaClient_default.$queryRaw`SELECT 1`;
      dbLatency = `${Date.now() - dbStart}ms`;
    } catch (error) {
      dbStatus = "DOWN";
    }
    let redisPrimaryLatency = "N/A";
    let redisPrimaryStatus = "HEALTHY";
    try {
      const start = Date.now();
      await redisPrimary.ping();
      redisPrimaryLatency = `${Date.now() - start}ms`;
    } catch (error) {
      redisPrimaryStatus = "DOWN";
    }
    let redisBackupLatency = "N/A";
    let redisBackupStatus = "HEALTHY";
    if (redisBackup) {
      try {
        const start = Date.now();
        await redisBackup.ping();
        redisBackupLatency = `${Date.now() - start}ms`;
      } catch (error) {
        redisBackupStatus = "DOWN";
      }
    } else {
      redisBackupStatus = "UNCONFIGURED";
    }
    let cloudPrimaryStatus = "HEALTHY";
    let cloudPrimaryLatency = "N/A";
    try {
      const start = Date.now();
      await cloudinary2.api.ping(cloudinaryPrimaryConfig);
      cloudPrimaryLatency = `${Date.now() - start}ms`;
    } catch (error) {
      cloudPrimaryStatus = "DOWN";
    }
    let cloudBackupStatus = "HEALTHY";
    let cloudBackupLatency = "N/A";
    try {
      const start = Date.now();
      await cloudinary2.api.ping(cloudinaryBackupConfig);
      cloudBackupLatency = `${Date.now() - start}ms`;
    } catch (error) {
      cloudBackupStatus = "DOWN";
    }
    let geminiHealth = await MultiLevelCache.get("admin:gemini_health");
    if (!geminiHealth) {
      geminiHealth = {
        primary: { status: "HEALTHY", latency: "N/A" },
        backup: { status: "HEALTHY", latency: "N/A" }
      };
      const primaryKey = process.env.GEMINI_API_KEY;
      if (primaryKey) {
        try {
          const start = Date.now();
          const genAI = new GoogleGenerativeAI2(primaryKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          await model.countTokens("ping");
          geminiHealth.primary.latency = `${Date.now() - start}ms`;
        } catch (error) {
          geminiHealth.primary.status = "DOWN";
        }
      } else {
        geminiHealth.primary.status = "UNCONFIGURED";
      }
      const backupKey = process.env.GEMINI_SECONDARY_KEY;
      if (backupKey) {
        try {
          const start = Date.now();
          const genAI = new GoogleGenerativeAI2(backupKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          await model.countTokens("ping");
          geminiHealth.backup.latency = `${Date.now() - start}ms`;
        } catch (error) {
          geminiHealth.backup.status = "DOWN";
        }
      } else {
        geminiHealth.backup.status = "UNCONFIGURED";
      }
      await MultiLevelCache.set("admin:gemini_health", geminiHealth, 300);
    }
    return {
      server: {
        status: "UP",
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        provider: "PostgreSQL (Supabase)"
      },
      redis: {
        primary: {
          status: redisPrimaryStatus,
          latencyMs: redisPrimaryLatency,
          name: "Upstash Redis Primary"
        },
        backup: {
          status: redisBackupStatus,
          latencyMs: redisBackupLatency,
          name: "Upstash Redis Backup"
        },
        activeProvider: redisPrimaryStatus === "HEALTHY" ? "PRIMARY" : "BACKUP (Failover)"
      },
      cloudinary: {
        primary: {
          status: cloudPrimaryStatus,
          latencyMs: cloudPrimaryLatency,
          name: "Cloudinary Primary"
        },
        backup: {
          status: cloudBackupStatus,
          latencyMs: cloudBackupLatency,
          name: "Cloudinary Backup"
        },
        activeProvider: cloudPrimaryStatus === "HEALTHY" ? "PRIMARY" : "BACKUP (Failover)"
      },
      gemini: {
        primaryKey: {
          status: geminiHealth.primary.status,
          latencyMs: geminiHealth.primary.latency
        },
        backupKey: {
          status: geminiHealth.backup.status,
          latencyMs: geminiHealth.backup.latency
        },
        model: "gemini-2.5-flash",
        activeKey: geminiHealth.primary.status === "HEALTHY" ? "PRIMARY_KEY" : "BACKUP_KEY"
      },
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
      }
    };
  }
};

// Controller/adminController.ts
init_prismaClient();
var catchAsync4 = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
var AdminController = class {
  static getStats = catchAsync4(async (req, res) => {
    const stats = await AdminService.getSystemStats();
    res.status(200).json({ success: true, data: stats });
  });
  static getUsers = catchAsync4(async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const search = req.query.search ? String(req.query.search) : void 0;
    const result = await AdminService.getAllUsers({
      page,
      limit,
      ...search && { search }
    });
    res.status(200).json({ success: true, data: result });
  });
  static massGift = catchAsync4(async (req, res) => {
    const user = req.user;
    const adminUserId = user?.id || user?.userId;
    const { amount, batchId, targetType, targetId, reason } = req.body;
    const result = await AdminService.executeMassGift({
      adminUserId: Number(adminUserId),
      amount: Number(amount),
      batchId,
      targetType,
      targetId,
      reason
    });
    res.status(200).json({
      success: true,
      message: `Ph\xE1t qu\xE0 th\xE0nh c\xF4ng cho ${result.totalUsersGifted} ng\u01B0\u1EDDi d\xF9ng!`,
      data: result
    });
  });
  static getAuditLogs = catchAsync4(async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 15;
    const batchId = req.query.batchId ? String(req.query.batchId) : void 0;
    const action = req.query.action ? String(req.query.action) : void 0;
    const userId = req.query.userId ? Number(req.query.userId) : void 0;
    const result = await AdminService.getAuditLogs({
      page,
      limit,
      ...batchId && { batchId },
      ...action && { action },
      ...userId && { userId }
    });
    res.status(200).json({ success: true, data: result });
  });
  static getHealth = catchAsync4(async (req, res) => {
    const healthData = await AdminService.getHealthStatus();
    const isHealthy = healthData.database.status === "HEALTHY";
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: healthData
    });
  });
  // Mở khóa ví thủ công (Đã dời vào trong class)
  static unlockWallet = catchAsync4(async (req, res) => {
    const { userId } = req.params;
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ success: false, message: "User ID kh\xF4ng h\u1EE3p l\u1EC7!" });
    }
    const numericUserId = Number(userId);
    await prismaClient_default.$transaction(async (tx) => {
      await tx.wallets.update({
        where: { userId: numericUserId },
        data: { isLocked: false }
      });
      await tx.auditLog.create({
        data: {
          requestId: `MANUAL-UNLOCK-${Date.now()}`,
          userId: numericUserId,
          action: "ADMIN_UNLOCK_WALLET",
          resource: "Wallets",
          resourceId: String(numericUserId),
          oldData: { isLocked: true },
          newData: {
            isLocked: false,
            note: "Admin \u0111\xE3 ki\u1EC3m tra log v\xE0 x\xE1c nh\u1EADn m\u1EDF kh\xF3a v\xED th\u1EE7 c\xF4ng"
          },
          ipAddress: req.ip || "127.0.0.1"
        }
      });
    });
    return res.status(200).json({
      success: true,
      message: `\u0110\xE3 m\u1EDF kh\xF3a v\xED th\xE0nh c\xF4ng cho User #${numericUserId}!`
    });
  });
};

// Router/adminRoutes.ts
init_reconciliationService();

// Validation/adminValidation.ts
import { z as z5 } from "zod";
var getStatsSchema = z5.object({
  query: z5.object({}).passthrough().optional(),
  body: z5.object({}).passthrough().optional()
});
var getUsersSchema = z5.object({
  query: z5.object({
    page: z5.string().optional(),
    limit: z5.string().optional(),
    search: z5.string().optional()
  }).optional()
});
var massGiftSchema = z5.object({
  body: z5.object({
    amount: z5.number({ message: "Vui l\xF2ng nh\u1EADp s\u1ED1 ti\u1EC1n h\u1EE3p l\u1EC7" }).min(1e3, "S\u1ED1 ti\u1EC1n t\u1ED1i thi\u1EC3u l\xE0 1,000 VN\u0110"),
    batchId: z5.string().min(5, "Batch ID ph\u1EA3i d\xE0i \xEDt nh\u1EA5t 5 k\xFD t\u1EF1"),
    reason: z5.string().min(10, "Vui l\xF2ng nh\u1EADp l\xFD do r\xF5 r\xE0ng \u0111\u1EC3 l\u01B0u Audit Log"),
    targetType: z5.enum(["ALL", "SINGLE"]),
    targetId: z5.string().optional(),
    giftType: z5.enum(["MONEY", "VOUCHER"]).optional()
  })
});
var getAuditLogsSchema = z5.object({
  query: z5.object({
    page: z5.string().optional(),
    limit: z5.string().optional(),
    batchId: z5.string().optional(),
    action: z5.string().optional(),
    userId: z5.string().optional()
  }).optional()
});
var getHealthSchema = z5.object({
  query: z5.object({}).passthrough().optional(),
  body: z5.object({}).passthrough().optional()
});

// Router/adminRoutes.ts
var router5 = Router5();
router5.use(authenticateToken, requireAdmin);
router5.get(
  "/dashboard-stats",
  validate(getStatsSchema),
  AdminController.getStats
);
router5.get("/users", validate(getUsersSchema), AdminController.getUsers);
router5.post("/mass-gift", validate(massGiftSchema), AdminController.massGift);
router5.get(
  "/system-health",
  validate(getHealthSchema),
  AdminController.getHealth
);
router5.get(
  "/audit-logs",
  validate(getAuditLogsSchema),
  AdminController.getAuditLogs
);
router5.post("/revoke-batch", async (req, res, next) => {
  try {
    const { batchId } = req.body;
    const adminUserId = req.user?.id || req.user?.userId;
    const result = await RevocationService.revokeBatch(
      batchId,
      Number(adminUserId)
    );
    res.status(200).json({ success: true, message: "Thu h\u1ED3i th\xE0nh c\xF4ng!", data: result });
  } catch (error) {
    next(error);
  }
});
router5.post("/reconciliation/trigger", async (req, res) => {
  try {
    const report = await ReconciliationService.runDailyReconciliation();
    return res.status(200).json({
      success: true,
      message: "\u0110\xE3 ho\xE0n th\xE0nh ti\u1EBFn tr\xECnh ki\u1EC3m tra \u0111\u1ED1i so\xE1t t\xE0i ch\xEDnh.",
      data: report
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "L\u1ED7i h\u1EC7 th\u1ED1ng khi th\u1EF1c hi\u1EC7n \u0111\u1ED1i so\xE1t.",
      error: error.message
    });
  }
});
router5.patch("/wallets/:userId/unlock", AdminController.unlockWallet);
var adminRoutes_default = router5;

// Router/authRoutes.ts
import { Router as Router6 } from "express";

// Service/authService.ts
init_prismaClient();
import bcrypt2 from "bcryptjs";
import crypto5 from "crypto";
import jwt3 from "jsonwebtoken";

// Utils/encryption.ts
import crypto4 from "crypto";
var ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    "Thi\u1EBFu ho\u1EB7c sai \u0111\u1ECBnh d\u1EA1ng ENCRYPTION_KEY (ph\u1EA3i l\xE0 64 k\xFD t\u1EF1 Hex)!"
  );
}
var ALGORITHM = "aes-256-gcm";
var keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
var EncryptionService = class {
  static encrypt(text) {
    if (!text) return text;
    const iv = crypto4.randomBytes(12);
    const cipher = crypto4.createCipheriv(ALGORITHM, keyBuffer, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }
  static decrypt(encryptedData) {
    if (!encryptedData || !encryptedData.includes(":")) return encryptedData;
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(":");
    const decipher = crypto4.createDecipheriv(
      ALGORITHM,
      keyBuffer,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
};

// Service/authService.ts
var ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
var REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error(
    "Thi\u1EBFu JWT_ACCESS_SECRET ho\u1EB7c JWT_REFRESH_SECRET trong .env!"
  );
}
var AuthService = class {
  /**
   * Hàm dùng chung để tạo cặp Access Token & Refresh Token
   */
  static generateTokensForUser(user) {
    const accessPayload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      type: "access"
    };
    const refreshPayload = {
      id: user.id,
      userId: user.id,
      type: "refresh"
    };
    const accessToken = jwt3.sign(accessPayload, ACCESS_TOKEN_SECRET, {
      expiresIn: "15m",
      jwtid: crypto5.randomUUID()
    });
    const refreshToken = jwt3.sign(refreshPayload, REFRESH_TOKEN_SECRET, {
      expiresIn: "7d",
      jwtid: crypto5.randomUUID()
    });
    return { accessToken, refreshToken };
  }
  /**
   * Đăng nhập hệ thống
   */
  static async login(data) {
    const inputPassword = data.pass || data.password || "";
    const user = await prismaClient_default.users.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      include: { wallet: true }
    });
    if (!user) {
      const error = new Error("Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c!");
      error.statusCode = 400;
      throw error;
    }
    if (!user.password) {
      const error = new Error(
        "T\xE0i kho\u1EA3n n\xE0y ch\u01B0a thi\u1EBFt l\u1EADp m\u1EADt kh\u1EA9u. Vui l\xF2ng \u0111\u0103ng nh\u1EADp b\u1EB1ng V\xE2n tay (Passkey)!"
      );
      error.statusCode = 400;
      throw error;
    }
    const isPasswordValid = await bcrypt2.compare(inputPassword, user.password);
    if (!isPasswordValid) {
      const error = new Error("Email ho\u1EB7c m\u1EADt kh\u1EA9u kh\xF4ng ch\xEDnh x\xE1c!");
      error.statusCode = 400;
      throw error;
    }
    const tokens = this.generateTokensForUser(user);
    const { password, currentChallenge, ...userWithoutPassword } = user;
    return {
      ...tokens,
      user: userWithoutPassword
    };
  }
  /**
   * Cấp lại Access Token mới dựa vào Refresh Token (có ROTATION)
   */
  static async refreshToken(refreshToken) {
    try {
      const decoded = jwt3.verify(refreshToken, REFRESH_TOKEN_SECRET);
      if (decoded.type !== "refresh") {
        throw new Error("Sai lo\u1EA1i token!");
      }
      if (decoded.jti && await RevocationService.isRevoked(decoded.jti)) {
        throw new Error("Refresh token \u0111\xE3 b\u1ECB thu h\u1ED3i!");
      }
      const user = await prismaClient_default.users.findUnique({
        where: { id: decoded.id ?? decoded.userId },
        include: { wallet: true }
      });
      if (!user) {
        const error = new Error("Ng\u01B0\u1EDDi d\xF9ng kh\xF4ng t\u1ED3n t\u1EA1i!");
        error.statusCode = 401;
        throw error;
      }
      if (decoded.jti && decoded.exp) {
        await RevocationService.revoke(decoded.jti, decoded.exp);
      }
      const tokens = this.generateTokensForUser(user);
      const { password, currentChallenge, ...userWithoutPassword } = user;
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: userWithoutPassword
      };
    } catch (err) {
      if (err.statusCode) throw err;
      const error = new Error(
        "Phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i!"
      );
      error.statusCode = 401;
      throw error;
    }
  }
  /**
   * Đăng ký thông thường (không OTP) - CÓ MÃ HÓA SỐ ĐIỆN THOẠI
   */
  static async register(data) {
    const { fullName, email, password, phoneNumber } = data;
    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await prismaClient_default.users.findUnique({
      where: { email: cleanEmail }
    });
    if (existingUser) {
      const error = new Error("Email \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng!");
      error.statusCode = 400;
      throw error;
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt2.hash(password, saltRounds);
    const encryptedPhone = phoneNumber ? EncryptionService.encrypt(phoneNumber) : null;
    const newUser = await prismaClient_default.users.create({
      data: {
        fullName,
        email: cleanEmail,
        password: hashedPassword,
        phoneNumber: encryptedPhone,
        role: "CUSTOMER",
        wallet: {
          create: { balance: 0 }
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    return newUser;
  }
  /**
   * 3. Yêu cầu gửi OTP - GIỮ NGUYÊN
   */
  static async requestOtp(email, type) {
    const cleanEmail = email.toLowerCase().trim();
    if (type === "REGISTER") {
      const existingUser = await prismaClient_default.users.findUnique({
        where: { email: cleanEmail }
      });
      if (existingUser) {
        const error = new Error("Email n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng!");
        error.statusCode = 400;
        throw error;
      }
    } else if (type === "FORGOT_PASSWORD") {
      const user = await prismaClient_default.users.findUnique({
        where: { email: cleanEmail }
      });
      if (!user) {
        const error = new Error("Email kh\xF4ng t\u1ED3n t\u1EA1i trong h\u1EC7 th\u1ED1ng!");
        error.statusCode = 404;
        throw error;
      }
    }
    return await OtpService.createOTPLogic(cleanEmail, type);
  }
  /**
   * Đăng ký tài khoản kèm OTP - CÓ MÃ HÓA SỐ ĐIỆN THOẠI
   */
  static async completeRegister(data) {
    const { fullName, email, password, otp, phoneNumber } = data;
    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await prismaClient_default.users.findUnique({
      where: { email: cleanEmail }
    });
    if (existingUser) {
      const error = new Error("Email n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD s\u1EED d\u1EE5ng!");
      error.statusCode = 400;
      throw error;
    }
    await OtpService.verifyOTPLogic(cleanEmail, otp, "REGISTER");
    const hashedPassword = await bcrypt2.hash(password, 10);
    const encryptedPhone = phoneNumber ? EncryptionService.encrypt(phoneNumber) : null;
    return await prismaClient_default.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          fullName,
          email: cleanEmail,
          password: hashedPassword,
          phoneNumber: encryptedPhone,
          role: "CUSTOMER",
          wallet: {
            create: {
              balance: 0
            }
          }
        },
        include: {
          wallet: true
        }
      });
      const {
        password: _,
        currentChallenge: __,
        ...userWithoutPassword
      } = newUser;
      return userWithoutPassword;
    });
  }
  /**
   * Đặt lại mật khẩu qua OTP - GIỮ NGUYÊN
   */
  static async resetPassword(data) {
    const { email, otp, newPassword } = data;
    const cleanEmail = email.toLowerCase().trim();
    const user = await prismaClient_default.users.findUnique({
      where: { email: cleanEmail }
    });
    if (!user) {
      const error = new Error("T\xE0i kho\u1EA3n kh\xF4ng t\u1ED3n t\u1EA1i!");
      error.statusCode = 404;
      throw error;
    }
    await OtpService.verifyOTPLogic(cleanEmail, otp, "FORGOT_PASSWORD");
    const hashedPassword = await bcrypt2.hash(newPassword, 10);
    return await prismaClient_default.users.update({
      where: { id: user.id },
      data: { password: hashedPassword },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true
      }
    });
  }
};

// Controller/authController.ts
var isProduction2 = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
var REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction2,
  // Bắt buộc true khi chạy HTTPS (Vercel)
  sameSite: isProduction2 ? "none" : "lax",
  // 'none' an toàn nhất khi có thể có domain phụ
  maxAge: 7 * 24 * 60 * 60 * 1e3,
  path: "/api/auth"
};
var AuthController = class {
  /**
   * Đăng nhập: Gửi Refresh Token qua HttpOnly Cookie, Access Token qua JSON
   */
  static async login(req, res) {
    try {
      const result = await AuthService.login(req.body);
      const { refreshToken, accessToken, user } = result;
      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS);
      return res.json({
        success: true,
        message: "\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng!",
        data: {
          user,
          accessToken
        }
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || "\u0110\u0103ng nh\u1EADp th\u1EA5t b\u1EA1i"
      });
    }
  }
  /**
   * Cấp lại Access Token mới dựa vào Refresh Token trong Cookie
   */
  static async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn l\xE0m vi\u1EC7c! Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i."
        });
      }
      const result = await AuthService.refreshToken(refreshToken);
      res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTS);
      return res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user
        }
      });
    } catch (err) {
      res.clearCookie("refreshToken", { ...REFRESH_COOKIE_OPTS, maxAge: 0 });
      return res.status(err.statusCode || 401).json({
        success: false,
        message: err.message || "Phi\xEAn l\xE0m vi\u1EC7c \u0111\xE3 h\u1EBFt h\u1EA1n!"
      });
    }
  }
  /**
   * Đăng xuất: Thu hồi token trên server và Xóa Cookie
   */
  static async logout(req, res) {
    try {
      const accessToken = req.headers.authorization?.split(" ")[1];
      const refreshToken = req.cookies?.refreshToken;
      await RevocationService.revokePair(accessToken, refreshToken);
      res.clearCookie("refreshToken", { ...REFRESH_COOKIE_OPTS, maxAge: 0 });
      return res.json({
        success: true,
        message: "\u0110\u0103ng xu\u1EA5t th\xE0nh c\xF4ng!"
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "L\u1ED7i khi \u0111\u0103ng xu\u1EA5t"
      });
    }
  }
  /**
   * Đăng ký thông thường
   */
  static async register(req, res) {
    try {
      const newUser = await AuthService.register(req.body);
      return res.status(201).json({
        success: true,
        message: "\u0110\u0103ng k\xFD th\xE0nh c\xF4ng!",
        data: newUser
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }
  /**
   * Yêu cầu gửi OTP
   */
  static async requestOtp(req, res) {
    try {
      const { email, type } = req.body;
      await AuthService.requestOtp(email, type);
      return res.json({
        success: true,
        message: "M\xE3 OTP \u0111\xE3 \u0111\u01B0\u1EE3c g\u1EEDi \u0111\u1EBFn email c\u1EE7a b\u1EA1n."
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }
  /**
   * Đăng ký hoàn tất kèm OTP
   */
  static async completeRegister(req, res) {
    try {
      const newUser = await AuthService.completeRegister(req.body);
      return res.status(201).json({
        success: true,
        message: "\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n th\xE0nh c\xF4ng!",
        userId: newUser.id
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }
  /**
   * Đặt lại mật khẩu bằng OTP
   */
  static async resetPassword(req, res) {
    try {
      await AuthService.resetPassword(req.body);
      return res.json({
        success: true,
        message: "\u0110\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u th\xE0nh c\xF4ng! Vui l\xF2ng \u0111\u0103ng nh\u1EADp l\u1EA1i."
      });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
  }
};

// Controller/webauthnController.ts
init_prismaClient();
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
var rpName = "NexusTicket";
var rpID = process.env.WEBAUTHN_RP_ID || "localhost";
var origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:5173";
var WebAuthnController = class {
  /**
   * 1. Tạo Challenge để đăng ký Passkey (User phải đang đăng nhập)
   */
  static async generateRegistration(req, res) {
    try {
      const userId = req.user?.id;
      const user = await prismaClient_default.users.findUnique({
        where: { id: userId },
        include: { credentials: true }
      });
      if (!user)
        return res.status(404).json({ message: "Ng\u01B0\u1EDDi d\xF9ng kh\xF4ng t\u1ED3n t\u1EA1i" });
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(userId.toString()),
        userName: user.email,
        excludeCredentials: user.credentials.map((cred) => ({
          id: cred.credentialID,
          type: "public-key",
          transports: cred.transports ? cred.transports.split(",") : void 0
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred"
        }
      });
      await prismaClient_default.users.update({
        where: { id: userId },
        data: { currentChallenge: options.challenge }
      });
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  /**
   * 2. Xác thực Đăng ký Passkey
   */
  static async verifyRegistration(req, res) {
    try {
      const userId = req.user?.id;
      const { body } = req;
      const user = await prismaClient_default.users.findUnique({ where: { id: userId } });
      if (!user || !user.currentChallenge) {
        return res.status(400).json({ message: "Kh\xF4ng t\xECm th\u1EA5y challenge h\u1EE3p l\u1EC7" });
      }
      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID
      });
      if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;
        const { id, publicKey, counter } = credential;
        await prismaClient_default.webAuthnCredential.create({
          data: {
            userId: user.id,
            credentialID: id,
            publicKey: Buffer.from(publicKey).toString("base64url"),
            counter,
            transports: body.response.transports?.join(",") || ""
          }
        });
        return res.json({
          success: true,
          message: "\u0110\u0103ng k\xFD V\xE2n tay/Khu\xF4n m\u1EB7t th\xE0nh c\xF4ng!"
        });
      }
      return res.status(400).json({ success: false, message: "X\xE1c th\u1EF1c th\u1EA5t b\u1EA1i!" });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
  /**
   * 3. Tạo Challenge để đăng nhập bằng Passkey
   */
  static async generateAuthentication(req, res) {
    try {
      const { email } = req.body;
      const user = await prismaClient_default.users.findUnique({
        where: { email },
        include: { credentials: true }
      });
      if (!user || user.credentials.length === 0) {
        return res.status(404).json({ message: "T\xE0i kho\u1EA3n n\xE0y ch\u01B0a c\xE0i \u0111\u1EB7t V\xE2n tay/Khu\xF4n m\u1EB7t!" });
      }
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: user.credentials.map((cred) => ({
          id: cred.credentialID,
          type: "public-key",
          transports: cred.transports ? cred.transports.split(",") : void 0
        })),
        userVerification: "preferred"
      });
      await prismaClient_default.users.update({
        where: { id: user.id },
        data: { currentChallenge: options.challenge }
      });
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  /**
   * 4. Xác thực Đăng nhập Passkey & Cấp JWT
   */
  static async verifyAuthentication(req, res) {
    try {
      const { email, body } = req.body;
      const user = await prismaClient_default.users.findUnique({
        where: { email },
        include: { credentials: true, wallet: true }
      });
      if (!user || !user.currentChallenge) {
        return res.status(400).json({ message: "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7" });
      }
      const passkey = user.credentials.find((c) => c.credentialID === body.id);
      if (!passkey)
        return res.status(400).json({ message: "Passkey kh\xF4ng h\u1EE3p l\u1EC7!" });
      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialID,
          publicKey: Buffer.from(passkey.publicKey, "base64url"),
          counter: passkey.counter,
          transports: passkey.transports ? passkey.transports.split(",") : void 0
        }
      });
      if (verification.verified) {
        await prismaClient_default.webAuthnCredential.update({
          where: { id: passkey.id },
          data: { counter: verification.authenticationInfo.newCounter }
        });
        const tokens = AuthService.generateTokensForUser(user);
        const { password, currentChallenge, ...userWithoutPassword } = user;
        res.cookie("refreshToken", tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1e3,
          path: "/api/auth"
        });
        return res.json({
          success: true,
          accessToken: tokens.accessToken,
          user: userWithoutPassword
        });
      }
      return res.status(400).json({ message: "X\xE1c th\u1EF1c Passkey th\u1EA5t b\u1EA1i!" });
    } catch (error) {
      console.error("WebAuthn Login Error:", error);
      return res.status(400).json({ message: error.message });
    }
  }
};

// Validation/authValidation.ts
import { z as z6 } from "zod";
var ALLOWED_TYPES2 = ["REGISTER", "FORGOT_PASSWORD"];
var loginSchema = z6.object({
  body: z6.object({
    email: z6.string().email("Email kh\xF4ng h\u1EE3p l\u1EC7"),
    password: z6.string().min(6, "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 6 k\xFD t\u1EF1")
  })
});
var registerSchema = z6.object({
  body: z6.object({
    fullName: z6.string({ message: "H\u1ECD t\xEAn kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng" }).min(2, "H\u1ECD t\xEAn ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 2 k\xFD t\u1EF1"),
    email: z6.string({ message: "Email kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng" }).email("Email kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng"),
    password: z6.string({ message: "M\u1EADt kh\u1EA9u kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng" }).min(6, "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 6 k\xFD t\u1EF1")
  })
});
var requestOtpSchema = z6.object({
  body: z6.object({
    email: z6.string({ message: "Email kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }).trim().email("\u0110\u1ECBnh d\u1EA1ng email kh\xF4ng h\u1EE3p l\u1EC7!"),
    type: z6.string().refine((val) => ALLOWED_TYPES2.includes(val), {
      message: "Lo\u1EA1i OTP ph\u1EA3i l\xE0 REGISTER ho\u1EB7c FORGOT_PASSWORD!"
    }).optional().default("REGISTER")
  })
});
var completeRegisterSchema = z6.object({
  body: z6.object({
    fullName: z6.string().min(2, "H\u1ECD t\xEAn ph\u1EA3i t\u1EEB 2 k\xFD t\u1EF1"),
    email: z6.string().trim().email("Email kh\xF4ng h\u1EE3p l\u1EC7"),
    password: z6.string().min(6, "M\u1EADt kh\u1EA9u ph\u1EA3i t\u1EEB 6 k\xFD t\u1EF1"),
    otp: z6.string().trim().length(6, "M\xE3 OTP ph\u1EA3i \u0111\xFAng 6 k\xFD t\u1EF1")
  })
});
var resetPasswordSchema = z6.object({
  body: z6.object({
    email: z6.string().trim().email("Email kh\xF4ng h\u1EE3p l\u1EC7"),
    otp: z6.string().trim().length(6, "M\xE3 OTP ph\u1EA3i \u0111\xFAng 6 k\xFD t\u1EF1"),
    newPassword: z6.string().min(6, "M\u1EADt kh\u1EA9u m\u1EDBi ph\u1EA3i t\u1EEB 6 k\xFD t\u1EF1")
  })
});

// Router/authRoutes.ts
var router6 = Router6();
router6.post(
  "/webauthn/login/generate",
  checkIpBlacklist,
  WebAuthnController.generateAuthentication
);
router6.post(
  "/webauthn/login/verify",
  checkIpBlacklist,
  WebAuthnController.verifyAuthentication
);
router6.get(
  "/webauthn/register/generate",
  authenticateToken,
  WebAuthnController.generateRegistration
);
router6.post(
  "/webauthn/register/verify",
  authenticateToken,
  WebAuthnController.verifyRegistration
);
router6.post(
  "/login",
  checkIpBlacklist,
  validate(loginSchema),
  AuthController.login
);
router6.post(
  "/request-otp",
  checkIpBlacklist,
  validate(requestOtpSchema),
  AuthController.requestOtp
);
router6.post(
  "/register",
  checkIpBlacklist,
  validate(completeRegisterSchema),
  AuthController.completeRegister
);
router6.post(
  "/reset-password",
  checkIpBlacklist,
  validate(resetPasswordSchema),
  AuthController.resetPassword
);
router6.post("/refresh-token", checkIpBlacklist, AuthController.refreshToken);
router6.post("/logout", AuthController.logout);
router6.get("/me", authenticateToken, UserController.getMe);
var authRoutes_default = router6;

// Router/bookingRoutes.ts
import { Router as Router7 } from "express";

// Service/bookingService.ts
init_prismaClient();
var BookingService = class {
  /**
   * 1. GIỮ GHẾ VÀ TẠO VÉ
   * Khóa 2 tầng: Redis (nhanh) + Postgres advisory lock (an toàn tuyệt đối).
   * Advisory lock tự nhả khi transaction commit/rollback.
   */
  static async holdOrBookSeat(userId, tripId, seatNumber, paymentMethod = "WALLET") {
    const lockKey = `lock:trip:${tripId}:seat:${seatNumber}`;
    const lockToken = await RedisLock.acquire(lockKey, 30);
    if (!lockToken) {
      const error = new Error(
        `Gh\u1EBF s\u1ED1 ${seatNumber} \u0111ang c\xF3 ng\u01B0\u1EDDi kh\xE1c thao t\xE1c ch\u1ECDn. Vui l\xF2ng ch\u1ECDn gh\u1EBF kh\xE1c!`
      );
      error.statusCode = 409;
      throw error;
    }
    try {
      const result = await prismaClient_default.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`seat:${tripId}:${seatNumber}`}))::text`;
          const existingTicket = await tx.tickets.findFirst({
            where: {
              tripId,
              seatNumber,
              status: { in: ["HELD", "PENDING", "CONFIRMED"] }
            }
          });
          if (existingTicket) {
            const error = new Error(
              `Gh\u1EBF s\u1ED1 ${seatNumber} \u0111\xE3 c\xF3 ng\u01B0\u1EDDi \u0111\u1EB7t ho\u1EB7c \u0111ang gi\u1EEF ch\u1ED7!`
            );
            error.statusCode = 400;
            throw error;
          }
          const trip = await tx.trips.findUnique({ where: { id: tripId } });
          if (!trip) {
            const error = new Error("Chuy\u1EBFn xe kh\xF4ng t\u1ED3n t\u1EA1i!");
            error.statusCode = 404;
            throw error;
          }
          let initialStatus = "PENDING";
          if (paymentMethod === "WALLET") {
            const wallet = await tx.wallets.findUnique({ where: { userId } });
            const currentBalance = Number(wallet?.balance || 0);
            const tripPrice = Number(trip.price);
            if (currentBalance < tripPrice) {
              const error = new Error(
                "S\u1ED1 d\u01B0 v\xED kh\xF4ng \u0111\u1EE7 \u0111\u1EC3 thanh to\xE1n v\xE9 n\xE0y!"
              );
              error.statusCode = 400;
              throw error;
            }
            await tx.wallets.update({
              where: { userId },
              data: { balance: { decrement: tripPrice } }
            });
            initialStatus = "CONFIRMED";
          }
          return tx.tickets.create({
            data: { userId, tripId, seatNumber, status: initialStatus }
          });
        },
        { timeout: 25e3 }
      );
      try {
        await MultiLevelCache.invalidate(`trips:detail:${tripId}`);
        await MultiLevelCache.invalidate("trips:all:active");
      } catch (cacheErr) {
        console.warn("[BOOKING] X\xF3a cache th\u1EA5t b\u1EA1i:", cacheErr.message);
      }
      return result;
    } finally {
      await RedisLock.release(lockKey, lockToken);
    }
  }
  /**
   * 2. KHÁCH HÀNG CHỦ ĐỘNG HỦY VÉ (có hoàn tiền nếu đã thanh toán)
   */
  static async cancelTicket(userId, ticketId) {
    const ticket = await prismaClient_default.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true }
    });
    if (!ticket) {
      const error = new Error("Kh\xF4ng t\xECm th\u1EA5y v\xE9 \u0111\u1EB7t!");
      error.statusCode = 404;
      throw error;
    }
    if (ticket.userId !== userId) {
      const error = new Error("B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n h\u1EE7y v\xE9 n\xE0y!");
      error.statusCode = 403;
      throw error;
    }
    if (ticket.status === "CANCELED" || ticket.status === "USED" || ticket.status === "REVOKED_BY_ADMIN") {
      const error = new Error("V\xE9 n\xE0y kh\xF4ng th\u1EC3 h\u1EE7y \u0111\u01B0\u1EE3c n\u1EEFa!");
      error.statusCode = 400;
      throw error;
    }
    const result = await prismaClient_default.$transaction(async (tx) => {
      const updatedTicket = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "CANCELED" }
      });
      if (ticket.status === "CONFIRMED") {
        await tx.wallets.update({
          where: { userId },
          data: { balance: { increment: ticket.trip.price } }
        });
      }
      return updatedTicket;
    });
    try {
      await MultiLevelCache.invalidate(`trips:detail:${ticket.tripId}`);
      await MultiLevelCache.invalidate("trips:all:active");
      await MultiLevelCache.invalidate(`user:${userId}:tickets*`);
    } catch (cacheErr) {
      console.warn("[BOOKING] X\xF3a cache th\u1EA5t b\u1EA1i:", cacheErr.message);
    }
    return result;
  }
  /**
   * 3. ADMIN THU HỒI VÉ (có hoàn tiền nếu đã thanh toán)
   * Đồng bộ với revocationService.revokeBatch — admin thu hồi cũng hoàn tiền.
   */
  static async adminRevokeTicket(ticketId) {
    const ticket = await prismaClient_default.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true }
    });
    if (!ticket) {
      const error = new Error("Kh\xF4ng t\xECm th\u1EA5y v\xE9!");
      error.statusCode = 404;
      throw error;
    }
    if (ticket.status === "REVOKED_BY_ADMIN" || ticket.status === "CANCELED") {
      const error = new Error("V\xE9 n\xE0y \u0111\xE3 b\u1ECB thu h\u1ED3i/h\u1EE7y tr\u01B0\u1EDBc \u0111\xF3!");
      error.statusCode = 400;
      throw error;
    }
    const result = await prismaClient_default.$transaction(async (tx) => {
      const updated = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "REVOKED_BY_ADMIN" }
      });
      if (ticket.status === "CONFIRMED") {
        await tx.wallets.update({
          where: { userId: ticket.userId },
          data: { balance: { increment: ticket.trip.price } }
        });
      }
      return updated;
    });
    try {
      await MultiLevelCache.invalidate(`trips:detail:${ticket.tripId}`);
      await MultiLevelCache.invalidate("trips:all:active");
      await MultiLevelCache.invalidate(`user:${ticket.userId}:tickets*`);
    } catch (cacheErr) {
      console.warn("[BOOKING] X\xF3a cache th\u1EA5t b\u1EA1i:", cacheErr.message);
    }
    return result;
  }
};

// Controller/bookingController.ts
init_prismaClient();
var catchAsync5 = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
var BookingController = class {
  static createBooking = catchAsync5(async (req, res) => {
    const userId = req.user?.id || req.user?.userId;
    if (!userId)
      return res.status(401).json({ success: false, message: "Ch\u01B0a \u0111\u0103ng nh\u1EADp!" });
    const { tripId, seatNumber, paymentMethod } = req.body;
    const ticket = await BookingService.holdOrBookSeat(
      Number(userId),
      Number(tripId),
      Number(seatNumber),
      paymentMethod || "WALLET"
    );
    return res.status(201).json({
      success: true,
      message: "\u0110\u1EB7t v\xE9 th\xE0nh c\xF4ng!",
      data: ticket
    });
  });
  static cancelBooking = catchAsync5(async (req, res) => {
    const userId = req.user?.id || req.user?.userId;
    const ticketId = Number(req.params.id);
    if (!userId)
      return res.status(401).json({ success: false, message: "Ch\u01B0a \u0111\u0103ng nh\u1EADp!" });
    const canceledTicket = await BookingService.cancelTicket(userId, ticketId);
    return res.json({
      success: true,
      message: "H\u1EE7y v\xE9 th\xE0nh c\xF4ng v\xE0 \u0111\xE3 ho\xE0n ti\u1EC1n v\xE0o v\xED (n\u1EBFu c\xF3)!",
      data: canceledTicket
    });
  });
  // Chuyển từ Ticket sang: Lấy danh sách vé của User
  static getUserTickets = catchAsync5(async (req, res) => {
    const userIdFromToken = req.user?.id || req.user?.userId;
    const role = req.user?.role;
    let targetUserId = Number(userIdFromToken);
    if (role === "ADMIN" && req.params.userId) {
      targetUserId = Number(req.params.userId);
    }
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "M\xE3 ng\u01B0\u1EDDi d\xF9ng kh\xF4ng h\u1EE3p l\u1EC7!" });
    }
    const tickets = await prismaClient_default.tickets.findMany({
      where: { userId: targetUserId },
      include: { trip: true },
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json({ success: true, data: tickets });
  });
};

// Validation/bookingValidation.ts
import { z as z7 } from "zod";
var createBookingSchema = z7.object({
  body: z7.object({
    tripId: z7.coerce.number({ message: "Trip ID kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!" }),
    // Hỗ trợ cả seatNumbers (mảng), seatIds (mảng chuỗi), hoặc seatNumber (số đơn)
    seatNumbers: z7.array(z7.coerce.number()).min(1, "S\u1ED1 gh\u1EBF kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!").optional(),
    seatIds: z7.array(z7.string()).optional(),
    seatNumber: z7.coerce.number().optional(),
    paymentMethod: z7.enum(["WALLET", "LATER"]).optional()
  }).refine((data) => data.seatNumbers || data.seatIds || data.seatNumber, {
    message: "S\u1ED1 gh\u1EBF kh\xF4ng \u0111\u01B0\u1EE3c b\u1ECF tr\u1ED1ng!",
    path: ["seatNumbers"]
  })
});

// Router/bookingRoutes.ts
var router7 = Router7();
router7.post(
  "/",
  authenticateToken,
  validate(createBookingSchema),
  BookingController.createBooking
);
router7.delete("/:id", authenticateToken, BookingController.cancelBooking);
router7.get("/my-tickets", authenticateToken, BookingController.getUserTickets);
router7.get(
  "/user/:userId",
  authenticateToken,
  BookingController.getUserTickets
);
var bookingRoutes_default = router7;

// Router/paymentRoutes.ts
import { Router as Router8 } from "express";

// Service/paymentService.ts
init_prismaClient();

// Utils/payos.ts
import axios from "axios";
import crypto6 from "crypto";
var PayOS = class {
  clientId;
  apiKey;
  checksumKey;
  constructor() {
    this.clientId = process.env.PAYOS_CLIENT_ID;
    this.apiKey = process.env.PAYOS_API_KEY;
    this.checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  }
  sortObjDataByKey(object) {
    return Object.keys(object).sort().reduce((obj, key) => {
      obj[key] = object[key];
      return obj;
    }, {});
  }
  convertObjToQueryStr(object) {
    return Object.keys(object).filter((key) => object[key] !== void 0).map((key) => {
      let value = object[key];
      if (value && Array.isArray(value)) {
        value = JSON.stringify(
          value.map((val) => this.sortObjDataByKey(val))
        );
      }
      if ([null, void 0, "undefined", "null"].includes(value)) {
        value = "";
      }
      return `${key}=${value}`;
    }).join("&");
  }
  createSignature(data) {
    const sortedData = this.sortObjDataByKey(data);
    const dataQueryStr = this.convertObjToQueryStr(sortedData);
    return crypto6.createHmac("sha256", this.checksumKey).update(dataQueryStr).digest("hex");
  }
  async createPaymentLink(data) {
    const signData = {
      amount: data.amount,
      cancelUrl: data.cancelUrl,
      description: data.description,
      orderCode: data.orderCode,
      returnUrl: data.returnUrl
    };
    const signature = this.createSignature(signData);
    try {
      const res = await axios.post(
        "https://api-merchant.payos.vn/v2/payment-requests",
        { ...data, signature },
        {
          headers: {
            "x-client-id": this.clientId,
            "x-api-key": this.apiKey
          }
        }
      );
      if (res.data.code === "00") return res.data.data;
      throw new Error(res.data.desc);
    } catch (err) {
      throw new Error(err.response?.data?.desc || err.message);
    }
  }
  verifyWebhookData(webhookBody) {
    const { data, signature } = webhookBody;
    if (!data || !signature) return false;
    const mySignature = this.createSignature(data);
    return mySignature === signature;
  }
};
var payosInstance = new PayOS();

// Service/paymentService.ts
var PaymentService = class {
  // 1. Tạo link thanh toán
  static async createTopUpLink(userId, amount) {
    if (amount < 1e4) throw new Error("S\u1ED1 ti\u1EC1n n\u1EA1p t\u1ED1i thi\u1EC3u l\xE0 10,000 VN\u0110");
    const orderCode = Number(Date.now().toString().slice(-9));
    const returnUrl = process.env.WEBAUTHN_ORIGIN || "http://localhost:5173";
    const transaction = await prismaClient_default.paymentTransaction.create({
      data: {
        orderCode,
        userId,
        amount,
        status: "PENDING"
      }
    });
    const paymentData = {
      orderCode,
      amount,
      description: `Nap tien vi NexusTicket`,
      cancelUrl: `${returnUrl}/customer/wallet`,
      returnUrl: `${returnUrl}/customer/wallet`
    };
    const paymentLinkRes = await payosInstance.createPaymentLink(paymentData);
    await prismaClient_default.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        checkoutUrl: paymentLinkRes.checkoutUrl,
        paymentLinkId: paymentLinkRes.paymentLinkId
      }
    });
    return paymentLinkRes.checkoutUrl;
  }
  // 2. Xử lý Webhook (Khi PayOS gọi về)
  static async handleWebhook(webhookBody) {
    const { code, success, data } = webhookBody;
    const isValid = payosInstance.verifyWebhookData(webhookBody);
    if (!isValid) throw new Error("Ch\u1EEF k\xFD kh\xF4ng h\u1EE3p l\u1EC7!");
    if (code === "00" && success === true) {
      const orderCode = Number(data.orderCode);
      const amountPaid = Number(data.amount);
      const transaction = await prismaClient_default.paymentTransaction.findUnique({
        where: { orderCode }
      });
      if (!transaction || transaction.status === "SUCCESS") return;
      if (amountPaid < Number(transaction.amount)) {
        await prismaClient_default.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: "FAILED" }
        });
        return;
      }
      await prismaClient_default.$transaction(async (tx) => {
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: "SUCCESS" }
        });
        const updatedWallet = await tx.wallets.update({
          where: { userId: transaction.userId },
          data: { balance: { increment: amountPaid } },
          select: { balance: true, id: true }
        });
        await tx.auditLog.create({
          data: {
            requestId: `PAYOS_${orderCode}`,
            userId: transaction.userId,
            action: "TOP_UP",
            resource: "Wallets",
            resourceId: String(updatedWallet.id),
            oldData: { balance: Number(updatedWallet.balance) - amountPaid },
            newData: {
              amount: amountPaid,
              description: `N\u1EA1p ti\u1EC1n qua PayOS (M\xE3: ${orderCode})`,
              newBalance: Number(updatedWallet.balance)
            }
          }
        });
      });
    }
  }
};

// Controller/paymentController.ts
var PaymentController = class {
  // FE gọi API này để lấy link thanh toán
  static async createTopUp(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const { amount } = req.body;
      const checkoutUrl = await PaymentService.createTopUpLink(
        Number(userId),
        Number(amount)
      );
      return res.status(200).json({
        success: true,
        message: "T\u1EA1o link thanh to\xE1n th\xE0nh c\xF4ng!",
        checkoutUrl
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
  // PayOS gọi API này (Server-to-Server)
  static async webhook(req, res) {
    try {
      await PaymentService.handleWebhook(req.body);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Webhook PayOS Error:", err.message);
      return res.status(200).json({ success: false, message: err.message });
    }
  }
};

// Router/paymentRoutes.ts
var router8 = Router8();
router8.post("/create", authenticateToken, PaymentController.createTopUp);
router8.post("/webhook", PaymentController.webhook);
var paymentRoutes_default = router8;

// app.ts
var app = express();
var allowedOrigins = ["http://localhost:5173", ENV.FRONTEND_URL].filter(
  Boolean
);
app.use(
  cors({
    origin: (origin2, callback) => {
      if (!origin2 || origin2 && origin2.endsWith(".vercel.app") || allowedOrigins.includes(origin2) || !isVercel) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "idempotency-key",
      "x-request-id",
      "X-Request-ID",
      "x-idempotency-key"
    ]
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(distributedTracing);
app.use("/api/otp", otpRoutes_default);
app.use("/api/trips", tripRoute_default);
app.use("/api/users", userRoutes_default);
app.use("/api/wallets", walletRoutes_default);
app.use("/api/admin", adminRoutes_default);
app.use("/api/auth", authRoutes_default);
app.use("/api/bookings", bookingRoutes_default);
app.use("/api/payments", paymentRoutes_default);
app.use(globalErrorHandler);
var app_default = app;

// server.ts
async function startBackgroundJobs() {
  if (isVercel) {
    console.log("M\xF4i tr\u01B0\u1EDDng Vercel Serverless: B\u1ECF qua Worker v\xE0 Cron Job.");
    return;
  }
  console.log("M\xF4i tr\u01B0\u1EDDng Local/VPS: \u0110ang kh\u1EDFi \u0111\u1ED9ng Worker v\xE0 Cron Job...");
  const { initReconciliationCron: initReconciliationCron2 } = await Promise.resolve().then(() => (init_reconciliationJob(), reconciliationJob_exports));
  initReconciliationCron2();
  await Promise.resolve().then(() => (init_mailQueue(), mailQueue_exports));
  console.log("Mail Worker \u0111\xE3 kh\u1EDFi \u0111\u1ED9ng v\xE0 \u0111ang ch\u1EDD Job.");
}
async function bootstrap() {
  await startBackgroundJobs();
  if (!isVercel) {
    const PORT = ENV.PORT;
    app_default.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  }
}
bootstrap().catch((error) => {
  console.error("L\u1ED7i kh\u1EDFi \u0111\u1ED9ng server:", error);
  process.exit(1);
});
var server_default = app_default;
export {
  server_default as default
};
