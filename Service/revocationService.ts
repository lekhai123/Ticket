// FILE: Services/revocationService.ts
import prisma from "../database/prismaClient";

export class RevocationService {
  /**
   * THU HỒI TỰ ĐỘNG HÀNG LOẠT THEO BATCH ID (Dành cho sự cố tặng vé/tiền nhầm)
   */
  static async revokeBatch(batchId: string, adminUserId: number) {
    const cleanBatchId = batchId.trim();

    return await prisma.$transaction(async (tx) => {
      // 1. Lấy toàn bộ Log của đợt phát nhầm chưa bị thu hồi (Không phân biệt hoa/thường)
      const logs = await tx.auditLog.findMany({
        where: {
          batchId: {
            equals: cleanBatchId,
            mode: "insensitive",
          },
          isRevoked: false,
          action: {
            not: "BATCH_REVOKE_EXECUTE", // Bỏ qua log thu hồi của Admin
          },
        },
      });

      if (!logs || logs.length === 0) {
        throw new Error(
          `Không tìm thấy dữ liệu giao dịch hoặc đợt tặng "${cleanBatchId}" đã được thu hồi trước đó!`,
        );
      }

      let revokedCount = 0;

      for (const log of logs) {
        // --- TRƯỜNG HỢP 1: THU HỒI VÉ TẶNG NHẦM ---
        if (
          (log.action === "SYSTEM_GIFT_TICKET" ||
            log.action === "MASS_GIFT_TICKET") &&
          (log.resource === "Tickets" || log.resource === "Ticket")
        ) {
          const ticketId = Number(log.resourceId);

          // Hủy vé nếu vé đang ở trạng thái CONFIRMED
          await tx.tickets.updateMany({
            where: { id: ticketId, status: "CONFIRMED" },
            data: { status: "REVOKED_BY_ADMIN" },
          });
        }

        // --- TRƯỜNG HỢP 2: THU HỒI TIỀN TẶNG NHẦM VÀO VÍ ---
        if (
          (log.action === "SYSTEM_GIFT_BALANCE" ||
            log.action === "MASS_GIFT_WALLET") &&
          (log.resource === "Wallets" || log.resource === "Wallet")
        ) {
          const walletId = Number(log.resourceId);

          // Bóc tách object newData linh hoạt (kể cả khi DB lưu dạng JSON string)
          // Bóc tách object newData linh hoạt
          const newDataObj = (
            typeof log.newData === "string"
              ? JSON.parse(log.newData)
              : log.newData
          ) as any;

          // 🎯 Quét bổ sung amountAdded từ log thực tế
          const giftedAmount = Number(
            newDataObj?.amountAdded ||
              newDataObj?.giftAmount ||
              newDataObj?.amount ||
              newDataObj?.balance ||
              newDataObj?.data?.amountAdded ||
              newDataObj?.data?.giftAmount ||
              newDataObj?.data?.amount ||
              0,
          );

          console.log(
            `🔍 [REVOKE DEBUG] Wallet ID: ${walletId} | Số tiền xác định trừ: ${giftedAmount}`,
          );

          if (giftedAmount > 0) {
            // Trừ lại chính xác số tiền đã tặng trong Ví
            await tx.wallets.update({
              where: { id: walletId },
              data: {
                balance: {
                  decrement: giftedAmount,
                },
              },
            });
          } else {
            console.warn(
              `⚠️ [REVOKE WARNING] Không tìm thấy số tiền hợp lệ (> 0) trong log ID ${log.id}. Cấu trúc newData:`,
              log.newData,
            );
          }
        }

        // 2. Đánh dấu AuditLog này đã bị Revoke thành công
        await tx.auditLog.update({
          where: { id: log.id },
          data: { isRevoked: true },
        });

        revokedCount++;
      }

      // 3. Ghi lại Log của chính hành động Thu Hồi này
      await tx.auditLog.create({
        data: {
          requestId: "ADMIN_REVOKE_ACTION",
          userId: adminUserId,
          action: "BATCH_REVOKE_EXECUTE",
          batchId: cleanBatchId,
          resource: "System",
          resourceId: cleanBatchId,
          newData: { revokedTotal: revokedCount },
        },
      });

      return { success: true, revokedCount };
    });
  }
}
