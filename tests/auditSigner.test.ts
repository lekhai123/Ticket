import { AuditSigner } from "../Utils/auditSigner";
import { describe, it, expect } from "@jest/globals";

describe("Kiểm thử Bảo mật - Chữ ký số AuditLog (HMAC)", () => {
  const mockData = {
    requestId: "REQ_123",
    userId: 1,
    action: "TOP_UP",
    resource: "Wallets",
    resourceId: "1",
    newData: { amount: 50000 },
    oldData: { amount: 0 },
  };

  it("Phải tạo ra chữ ký có độ dài 64 ký tự (SHA256)", () => {
    const signature = AuditSigner.generateSignature(mockData);
    expect(signature).toBeDefined();
    expect(signature.length).toBe(64);
  });

  it("Phải xác thực ĐÚNG nếu dữ liệu không bị sửa", () => {
    const signature = AuditSigner.generateSignature(mockData);
    const isValid = AuditSigner.verifySignature(mockData, signature);
    expect(isValid).toBe(true);
  });

  it("Phải xác thực SAI nếu Hacker sửa dữ liệu", () => {
    const signature = AuditSigner.generateSignature(mockData);

    // Hacker sửa amount từ 50000 thành 999999
    const tamperedData = { ...mockData, newData: { amount: 999999 } };
    const isValid = AuditSigner.verifySignature(tamperedData, signature);

    expect(isValid).toBe(false);
  });
});
