import Redis from "ioredis";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const primaryUrl = process.env.REDIS_URL;
const backupUrl = process.env.REDIS_URL_BACKUP;

if (!primaryUrl) {
  throw new Error("Khai báo thiếu REDIS_URL trong file .env!");
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

// 2. Khởi tạo Backup Redis
export const redisBackup = backupUrl
  ? new Redis(backupUrl, commonRedisOptions)
  : null;

redisPrimary.on("connect", () => {
  console.log("[REDIS PRIMARY]: Kết nối Redis Cloud thành công!");
});

redisPrimary.on("error", (err) => {
  console.error("[REDIS PRIMARY WARNING]:", err.message);
});

if (redisBackup) {
  redisBackup.on("connect", () => {
    console.log("[REDIS BACKUP]: Kết nối Redis Cloud Dự Phòng sẵn sàng!");
  });
  redisBackup.on("error", (err) => {
    console.error("[REDIS BACKUP WARNING]:", err.message);
  });
}

// Script Lua: chỉ set nếu chưa có key (atomic NX)
const ACQUIRE_LUA = `
  if redis.call("exists", KEYS[1]) == 1 then return 0 end
  redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
  return 1
`;

// Script Lua: chỉ xóa nếu value khớp (tránh xóa nhầm lock của người khác)
const RELEASE_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

export class RedisLock {
  /**
   * Danh sách Redis cần ghi lock.
   * Luôn có primary; thêm backup nếu backup đang ready.
   */
  private static targets(): Redis[] {
    const list: Redis[] = [redisPrimary];
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
  static async acquire(
    key: string,
    ttlSeconds: number = 30,
  ): Promise<string | null> {
    const lockToken = crypto.randomUUID();
    const clients = this.targets();

    const results = await Promise.allSettled(
      clients.map((c) => c.eval(ACQUIRE_LUA, 1, key, lockToken, ttlSeconds)),
    );

    // Primary phải acquire thành công
    const primaryOk =
      results[0].status === "fulfilled" && Number(results[0].value) === 1;

    if (!primaryOk) {
      // Primary fail nhưng backup lỡ acquire được → xóa backup để tránh lock rác
      if (
        clients.length === 2 &&
        results[1].status === "fulfilled" &&
        Number(results[1].value) === 1
      ) {
        await clients[1].eval(RELEASE_LUA, 1, key, lockToken).catch(() => {});
      }
      return null;
    }

    // Primary OK — kiểm tra backup nếu có
    if (clients.length === 2) {
      const backupResult = results[1];

      // Backup trả 0 = đang có lock của người khác → rollback primary
      if (
        backupResult.status === "fulfilled" &&
        Number(backupResult.value) === 0
      ) {
        await clients[0].eval(RELEASE_LUA, 1, key, lockToken).catch(() => {});
        console.warn(
          `[REDIS LOCK] Backup đang giữ "${key}" → rollback primary, trả null`,
        );
        return null;
      }

      // Backup rejected (lỗi mạng) → chấp nhận, backup đang chết không failover được
      if (backupResult.status === "rejected") {
        console.warn(
          `[REDIS LOCK] Backup lỗi khi acquire "${key}", chấp nhận lock chỉ trên primary`,
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
  static async release(key: string, lockToken: string): Promise<boolean> {
    const clients = this.targets();

    const results = await Promise.allSettled(
      clients.map((c) => c.eval(RELEASE_LUA, 1, key, lockToken)),
    );

    return results[0].status === "fulfilled" && Number(results[0].value) === 1;
  }
}
