// FILE: Utils/redisLock.ts
import Redis from "ioredis";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const primaryUrl = process.env.REDIS_URL;
const backupUrl = process.env["REDIS_URL-BACKUP"];

if (!primaryUrl) {
  throw new Error("❌ Khai báo thiếu REDIS_URL trong file .env!");
}

const commonRedisOptions = {
  tls: {
    rejectUnauthorized: false,
  },
  family: 4,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
};

// 1. Khởi tạo Primary Redis
export const redisPrimary = new Redis(primaryUrl, commonRedisOptions);

// 2. Khởi tạo Backup Redis (nếu có khai báo REDIS_URL-BACKUP)
export const redisBackup = backupUrl
  ? new Redis(backupUrl, commonRedisOptions)
  : null;

let isPrimaryAlive = true;

redisPrimary.on("connect", () => {
  isPrimaryAlive = true;
  console.log("⚡ [REDIS PRIMARY]: Kết nối Upstash Redis Cloud thành công!");
});

redisPrimary.on("error", (err) => {
  isPrimaryAlive = false;
  console.error("⚠️ [REDIS PRIMARY WARNING]:", err.message);
});

if (redisBackup) {
  redisBackup.on("connect", () => {
    console.log("⚡ [REDIS BACKUP]: Kết nối Redis Cloud Dự Phòng sẵn sàng!");
  });
  redisBackup.on("error", (err) => {
    console.error("⚠️ [REDIS BACKUP WARNING]:", err.message);
  });
}

export class RedisLock {
  /**
   * Tự động chọn Redis Client đang khả dụng (Primary -> Backup)
   */
  private static getActiveRedis(): Redis {
    if (isPrimaryAlive) {
      return redisPrimary;
    }
    if (redisBackup) {
      console.warn(
        "🔄 [REDIS LOCK FAILOVER] Đang chuyển sang dùng Redis Backup!",
      );
      return redisBackup;
    }
    return redisPrimary;
  }

  /**
   * 🔒 Bắt Lock ghế (Chống race condition)
   */
  static async acquire(
    key: string,
    ttlSeconds: number = 10,
  ): Promise<string | null> {
    const lockToken = crypto.randomUUID();
    const redisClient = this.getActiveRedis();

    try {
      const result = await redisClient.set(
        key,
        lockToken,
        "EX",
        ttlSeconds,
        "NX",
      );
      return result === "OK" ? lockToken : null;
    } catch (error) {
      console.error("Lỗi acquire Lock:", error);
      return null;
    }
  }

  /**
   * 🔓 Mở Lock an toàn bằng Lua Script (Atomic Operation)
   */
  static async release(key: string, lockToken: string): Promise<boolean> {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const redisClient = this.getActiveRedis();

    try {
      const result = await redisClient.eval(luaScript, 1, key, lockToken);
      return result === 1;
    } catch (error) {
      console.error("Lỗi release Lock:", error);
      return false;
    }
  }
}
