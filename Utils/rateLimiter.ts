import { redisPrimary } from "./redisLock";

// Bộ đếm dự phòng trong RAM (Dùng khi Redis sập)
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

export class RateLimiter {
  static async consume(
    key: string,
    limit: number,
    windowInSeconds: number,
  ): Promise<boolean> {
    const redisKey = `ratelimit:${key}`;

    const luaScript = `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("EXPIRE", KEYS[1], ARGV[1])
      end
      if current > tonumber(ARGV[2]) then
        return 0
      end
      return 1
    `;

    try {
      const result = await redisPrimary.eval(
        luaScript,
        1,
        redisKey,
        windowInSeconds,
        limit,
      );
      return result === 1;
    } catch (error) {
      console.warn("[RATE LIMITER] Redis sập, chuyển sang In-Memory Fallback");

      // --- BẮT ĐẦU FALLBACK IN-MEMORY ---
      const now = Date.now();
      const record = memoryStore.get(key);

      // Dọn dẹp các key hết hạn để tránh rò rỉ bộ nhớ (Memory Leak)
      if (memoryStore.size > 10000) {
        for (const [k, v] of memoryStore.entries()) {
          if (v.expiresAt < now) memoryStore.delete(k);
        }
      }

      if (!record || record.expiresAt < now) {
        // Bản ghi mới hoặc đã hết hạn -> Reset
        memoryStore.set(key, {
          count: 1,
          expiresAt: now + windowInSeconds * 1000,
        });
        return true;
      }

      if (record.count >= limit) {
        return false; // Vượt quá giới hạn
      }

      record.count += 1;
      return true;
      // --- KẾT THÚC FALLBACK ---
    }
  }
}
