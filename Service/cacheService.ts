import { LRUCache } from "lru-cache";
import { redisPrimary, redisBackup } from "../Utils/redisLock";
import type Redis from "ioredis";

// L1: cache RAM local, tối đa 500 key, TTL 2s
const localCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 2, // 2 giây
});
// Chuyển pattern kiểu Redis (`trip:*`) sang regex để lọc L1
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export class MultiLevelCache {
  /**
   * Lấy Redis đang sống (Primary → Backup).
   */
  private static getActiveRedis(): Redis | null {
    if (redisPrimary.status === "ready" || redisPrimary.status === "connect") {
      return redisPrimary;
    }
    if (
      redisBackup &&
      (redisBackup.status === "ready" || redisBackup.status === "connect")
    ) {
      console.warn("[CACHE FAILOVER] Đang dùng Redis Backup cho L2!");
      return redisBackup;
    }
    return null;
  }

  /**
   * Đọc dữ liệu: L1 (RAM) → L2 (Redis) → null (để caller tự query DB).
   * Có log thời gian từng tầng để đo hiệu quả cache.
   */
  static async get<T>(key: string): Promise<T | null> {
    const t0 = process.hrtime.bigint();

    // 1. L1 (RAM)
    if (localCache.has(key)) {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(`[CACHE L1] ${key} = ${ms.toFixed(2)}ms`);
      return localCache.get(key) as T;
    }

    // 2. L2 (Redis)
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        const redisData = await activeRedis.get(key);
        if (redisData) {
          const parsed = JSON.parse(redisData);
          localCache.set(key, parsed); // đồng bộ ngược lại L1
          const ms = Number(process.hrtime.bigint() - t0) / 1e6;
          console.log(`[CACHE L2] ${key} = ${ms.toFixed(2)}ms`);
          return parsed;
        }
      } catch (error: any) {
        console.warn(`[CACHE WARNING] Lỗi đọc Redis: ${error.message}`);
      }
    }

    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`[CACHE MISS] ${key} = ${ms.toFixed(2)}ms`);
    return null;
  }

  /**
   * Ghi dữ liệu đồng thời vào L1 (RAM) và L2 (Redis).
   */
  static async set(
    key: string,
    value: any,
    ttlSeconds: number = 300,
  ): Promise<void> {
    localCache.set(key, value, { ttl: ttlSeconds * 1000 });

    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        await activeRedis.setex(key, ttlSeconds, JSON.stringify(value));
      } catch (error: any) {
        console.warn(`[CACHE WARNING] Lỗi ghi Redis: ${error.message}`);
      }
    }
  }

  /**
   * Xóa 1 key cụ thể ở cả L1 và L2.
   */
  static async delete(key: string): Promise<void> {
    localCache.delete(key);
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        await activeRedis.del(key);
      } catch (error: any) {
        console.warn(`[CACHE WARNING] Lỗi xóa Redis: ${error.message}`);
      }
    }
  }

  /**
   * Xóa cache theo pattern (VD: "trip:123*").
   * Dùng SCAN thay KEYS để không block Redis.
   * Chỉ xóa các key L1 khớp pattern, không xóa toàn bộ.
   */
  static async invalidate(keyPattern: string): Promise<void> {
    // 1. Xóa L1 theo pattern (không clear tất cả)
    const regex = patternToRegex(keyPattern);
    for (const key of localCache.keys()) {
      if (regex.test(key)) localCache.delete(key);
    }

    // 2. Xóa L2 bằng SCAN (an toàn với Redis lớn)
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
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await activeRedis.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== "0");

      if (deletedCount > 0) {
        console.log(
          `[CACHE INVALIDATE] ${keyPattern} → xóa ${deletedCount} key L2`,
        );
      }
    } catch (error: any) {
      console.warn(
        `[CACHE WARNING] Lỗi invalidate "${keyPattern}": ${error.message}`,
      );
    }
  }
}
