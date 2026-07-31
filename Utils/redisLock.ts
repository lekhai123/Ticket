// FILE: Utils/redisLock.ts
import Redis from "ioredis";
import crypto from "crypto";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("❌ Khai báo thiếu REDIS_URL trong file .env!");
}

export const redis = new Redis(redisUrl, {
  // 🌟 BẮT BỘC CHO UPSTASH CLOUD: Bật TLS mã hóa kết nối
  tls: {
    rejectUnauthorized: false, // Bỏ qua lỗi SSL Certificate validation nếu có
  },
  family: 4, // Ép dùng IPv4 để tránh lỗi đứt socket kết nối (ECONNRESET)
  maxRetriesPerRequest: null, // Vô hiệu hóa giới hạn 20 retries gây crash app
  enableReadyCheck: false,
  keepAlive: 10000, // Gửi TCP KeepAlive mỗi 10 giây để giữ kết nối không bị ngắt
  retryStrategy(times) {
    // Tự động kết nối lại nếu bị đứt mạng
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("⚡ [REDIS]: Kết nối Upstash Redis Cloud thành công!");
});

redis.on("error", (err) => {
  // Log ngắn gọn để không tràn Terminal
  console.error("⚠️ [REDIS WARNING]:", err.message);
});
export class RedisLock {
  /**
   * 🔒 Bắt Lock ghế
   * @param key Tên key lock (VD: lock:trip:101:seat:12)
   * @param ttlSeconds Thời gian khóa tối đa (giây)
   * @returns lockToken nếu thành công, null nếu thất bại
   */
  static async acquire(
    key: string,
    ttlSeconds: number = 10,
  ): Promise<string | null> {
    const lockToken = crypto.randomUUID(); // Token ngẫu nhiên độc bản
    // NX: Chỉ set nếu chưa tồn tại | EX: Thời gian hết hạn (seconds)
    const result = await redis.set(key, lockToken, "EX", ttlSeconds, "NX");

    return result === "OK" ? lockToken : null;
  }

  /**
   * 🔓 Mở Lock an toàn (Dùng Lua Script để đảm bảo atomic - chỉ xóa khi đúng token)
   */
  static async release(key: string, lockToken: string): Promise<boolean> {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await redis.eval(luaScript, 1, key, lockToken);
    return result === 1;
  }
}
