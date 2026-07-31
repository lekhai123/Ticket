// FILE: Services/cacheService.ts
import { LRUCache } from "lru-cache";
import { redis } from "../Utils/redisLock";

// Layer 1: RAM Cache local (Siêu nhanh - Microseconds)
const localCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 10, // 10 giây
});

export class MultiLevelCache {
  static async get<T>(key: string): Promise<T | null> {
    // Check L1 (RAM)
    if (localCache.has(key)) {
      return localCache.get(key) as T;
    }

    // Check L2 (Redis)
    const redisData = await redis.get(key);
    if (redisData) {
      const parsed = JSON.parse(redisData);
      localCache.set(key, parsed); // Sync ngược lại L1
      return parsed;
    }

    return null;
  }

  static async set(
    key: string,
    value: any,
    ttlSeconds: number = 300,
  ): Promise<void> {
    localCache.set(key, value);
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  static async invalidate(keyPattern: string): Promise<void> {
    localCache.clear();
    const keys = await redis.keys(keyPattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
