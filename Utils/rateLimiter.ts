import { redisPrimary } from "./redisLock";

export class RateLimiter {
  /**
   * Thuật toán Fixed Window: Đếm số request trong 1 khoảng thời gian
   * @param key Khóa định danh (VD: IP hoặc UserID)
   * @param limit Số request tối đa
   * @param windowInSeconds Thời gian (giây)
   */
  static async consume(
    key: string,
    limit: number,
    windowInSeconds: number,
  ): Promise<boolean> {
    const redisKey = `ratelimit:${key}`;

    // Script Lua đảm bảo tính nguyên tử (Atomic)
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
      console.error("[RATE LIMITER] Lỗi Redis:", error);
      return true; // Fail-open: Nếu Redis lỗi, cho qua để không sập web
    }
  }
}
