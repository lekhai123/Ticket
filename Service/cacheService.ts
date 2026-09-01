// FILE: Services/cacheService.ts
import { LRUCache } from "lru-cache";
import { redisPrimary, redisBackup } from "../Utils/redisLock";
import type Redis from "ioredis";

// Layer 1: RAM Cache local (Siêu nhanh - Microseconds)
const localCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 10, // 10 giây
});

export class MultiLevelCache {
  /**
   * Helper lấy Redis Instance đang hoạt động (Primary -> Backup)
   */
  private static getActiveRedis(): Redis | null {
    if (redisPrimary.status === "ready" || redisPrimary.status === "connect") {
      return redisPrimary;
    }
    if (
      redisBackup &&
      (redisBackup.status === "ready" || redisBackup.status === "connect")
    ) {
      console.warn(
        "🔄 [CACHE FAILOVER] Đang sử dụng Redis Backup cho L2 Cache!",
      );
      return redisBackup;
    }
    return null;
  }

  /**
   * 🔍 Đọc dữ liệu: L1 (RAM) -> L2 (Redis Primary/Backup) -> DB Fallback
   */
  static async get<T>(key: string): Promise<T | null> {
    // 1. Check L1 (RAM Local)
    if (localCache.has(key)) {
      return localCache.get(key) as T;
    }

    // 2. Check L2 (Redis)
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        const redisData = await activeRedis.get(key);
        if (redisData) {
          const parsed = JSON.parse(redisData);
          localCache.set(key, parsed); // Sync ngược lại L1 RAM
          return parsed;
        }
      } catch (error: any) {
        console.warn(
          `⚠️ [CACHE WARNING] Lỗi đọc Redis Cache: ${error.message}`,
        );
      }
    }

    return null;
  }

  /**
   * 💾 Ghi dữ liệu đồng thời L1 (RAM) và L2 (Redis)
   */
  static async set(
    key: string,
    value: any,
    ttlSeconds: number = 300,
  ): Promise<void> {
    // Luôn ghi vào RAM L1
    localCache.set(key, value);

    // Ghi vào Redis L2 (Primary hoặc Backup)
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        await activeRedis.setex(key, ttlSeconds, JSON.stringify(value));
      } catch (error: any) {
        console.warn(
          `⚠️ [CACHE WARNING] Lỗi ghi Redis Cache: ${error.message}`,
        );
      }
    }
  }

  /**
   * 🧹 Xóa/Làm mới Cache
   */
  static async invalidate(keyPattern: string): Promise<void> {
    // Xóa sạch RAM Cache L1
    localCache.clear();

    // Xóa Key trên Redis L2
    const activeRedis = this.getActiveRedis();
    if (activeRedis) {
      try {
        const keys = await activeRedis.keys(keyPattern);
        if (keys.length > 0) {
          await activeRedis.del(...keys);
        }
      } catch (error: any) {
        console.warn(
          `⚠️ [CACHE WARNING] Lỗi invalidate Redis Cache: ${error.message}`,
        );
      }
    }
  }
}
