import crypto from "crypto";

const AUDIT_SECRET = process.env.AUDIT_SECRET_KEY;

export class AuditSigner {
  static generateSignature(data: any): string {
    // Sắp xếp lại các key để chuỗi JSON luôn đồng nhất
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    return crypto
      .createHmac("sha256", AUDIT_SECRET)
      .update(sortedData)
      .digest("hex");
  }

  static verifySignature(data: any, signature: string): boolean {
    if (!signature) return false;
    const expectedSignature = this.generateSignature(data);
    return expectedSignature === signature;
  }
}
