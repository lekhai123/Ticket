import crypto from "crypto";

const AUDIT_SECRET =
  process.env.AUDIT_SECRET_KEY || "NexusTicket_Audit_Secret_2026";

export class AuditSigner {
  static generateSignature(data: any): string {
    // Sắp xếp các key một cách đệ quy để đảm bảo tính nhất quán
    const sortObject = (obj: any): any => {
      if (obj === null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sortObject);
      return Object.keys(obj)
        .sort()
        .reduce((acc, key) => {
          acc[key] = sortObject(obj[key]);
          return acc;
        }, {} as any);
    };

    const signData = {
      requestId: data.requestId,
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      newData: data.newData,
      oldData: data.oldData,
    };

    const sortedData = JSON.stringify(sortObject(signData));
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
