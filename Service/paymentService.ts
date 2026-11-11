import prisma from "../database/prismaClient";
import { payosInstance } from "../Utils/payos";
import CircuitBreaker from "opossum";

// Cấu hình Cầu dao cho PayOS
const payosAction = async (paymentData: any) => {
  return await payosInstance.createPaymentLink(paymentData);
};

const payosBreaker = new CircuitBreaker(payosAction, {
  timeout: 10000, // PayOS thường phản hồi trong 1-2s, chờ tối đa 10s là ngắt
  errorThresholdPercentage: 50, // Ngắt nếu > 50% request lỗi
  volumeThreshold: 3, // Chỉ cần 3 request lỗi liên tiếp là ngắt
  resetTimeout: 60000, // Chờ 1 phút trước khi thử lại
});

// Khi PayOS sập, trả về lỗi ngay lập tức cho người dùng
payosBreaker.fallback(() => {
  throw new Error(
    "Cổng thanh toán PayOS đang bảo trì. Vui lòng thử lại sau 1 phút!",
  );
});

payosBreaker.on("open", () =>
  console.warn(`[Circuit Breaker] 🔴 MẠCH ĐÃ NGẮT: PayOS đang sập!`),
);

export class PaymentService {
  // 1. Tạo link thanh toán
  static async createTopUpLink(userId: number, amount: number) {
    if (amount < 10000) throw new Error("Số tiền nạp tối thiểu là 10,000 VNĐ");

    // Sinh orderCode ngẫu nhiên (9 chữ số)
    const orderCode = Number(Date.now().toString().slice(-9));
    const returnUrl = process.env.WEBAUTHN_ORIGIN || "http://localhost:5173";

    // Lưu DB trạng thái PENDING
    const transaction = await prisma.paymentTransaction.create({
      data: {
        orderCode,
        userId,
        amount,
        status: "PENDING",
      },
    });

    const paymentData = {
      orderCode,
      amount,
      description: `Nap tien vi NexusTicket`,
      cancelUrl: `${returnUrl}/customer/wallet`,
      returnUrl: `${returnUrl}/customer/wallet`,
    };

    // Gọi qua Cầu dao thay vì gọi trực tiếp payosInstance
    const paymentLinkRes = (await payosBreaker.fire(paymentData)) as any;

    // Cập nhật lại checkoutUrl vào DB
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        checkoutUrl: paymentLinkRes.checkoutUrl,
        paymentLinkId: paymentLinkRes.paymentLinkId,
      },
    });

    return paymentLinkRes.checkoutUrl;
  }

  // 2. Xử lý Webhook (Khi PayOS gọi về)
  static async handleWebhook(webhookBody: any) {
    const { code, success, data } = webhookBody;

    // Verify Signature (Chống hacker giả mạo)
    const isValid = payosInstance.verifyWebhookData(webhookBody);
    if (!isValid) throw new Error("Chữ ký không hợp lệ!");

    if (code === "00" && success === true) {
      const orderCode = Number(data.orderCode);
      const amountPaid = Number(data.amount);

      // Tìm giao dịch trong DB
      const transaction = await prisma.paymentTransaction.findUnique({
        where: { orderCode },
      });

      // Idempotency: Nếu đã SUCCESS rồi thì bỏ qua (PayOS có thể gọi 2 lần)
      if (!transaction || transaction.status === "SUCCESS") return;

      if (amountPaid < Number(transaction.amount)) {
        await prisma.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: "FAILED" },
        });
        return;
      }

      // Bọc trong Transaction để đảm bảo cộng tiền và update status đồng thời
      await prisma.$transaction(async (tx) => {
        // 1. Update trạng thái
        await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: "SUCCESS" },
        });

        // 2. Cộng tiền vào ví
        const updatedWallet = await tx.wallets.update({
          where: { userId: transaction.userId },
          data: { balance: { increment: amountPaid } },
          select: { balance: true, id: true },
        });

        // 3. Ghi AuditLog
        await tx.auditLog.create({
          data: {
            requestId: `PAYOS_${orderCode}`,
            userId: transaction.userId,
            action: "TOP_UP",
            resource: "Wallets",
            resourceId: String(updatedWallet.id),
            oldData: { balance: Number(updatedWallet.balance) - amountPaid },
            newData: {
              amount: amountPaid,
              description: `Nạp tiền qua PayOS (Mã: ${orderCode})`,
              newBalance: Number(updatedWallet.balance),
            },
          },
        });
      });
    }
  }
}
