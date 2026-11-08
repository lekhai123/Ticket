import { PayOS } from "../Utils/payos";
import crypto from "crypto";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
describe("Kiểm thử Bảo mật Webhook PayOS", () => {
  let payos: PayOS;
  const mockChecksumKey = "test_checksum_key";

  beforeAll(() => {
    process.env.PAYOS_CLIENT_ID = "test_id";
    process.env.PAYOS_API_KEY = "test_api";
    process.env.PAYOS_CHECKSUM_KEY = mockChecksumKey;
    payos = new PayOS();
  });

  it("Phải xác thực đúng chữ ký hợp lệ", () => {
    const data = { orderCode: 123, amount: 100000 };
    // Tạo chữ ký giả lập giống hệt PayOS
    const sortedData = Object.keys(data)
      .sort()
      .map((k) => `${k}=${data[k as keyof typeof data]}`)
      .join("&");
    const validSignature = crypto
      .createHmac("sha256", mockChecksumKey)
      .update(sortedData)
      .digest("hex");

    const isValid = payos.verifyWebhookData({
      data,
      signature: validSignature,
    });
    expect(isValid).toBe(true);
  });

  it("Phải từ chối chữ ký bị giả mạo (Hacker đổi số tiền)", () => {
    const data = { orderCode: 123, amount: 999999 }; // Hacker đổi thành 999k
    const fakeSignature = "chu_ky_gia_mao_123456";

    const isValid = payos.verifyWebhookData({ data, signature: fakeSignature });
    expect(isValid).toBe(false);
  });
});
