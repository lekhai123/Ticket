import prisma from "../database/prismaClient";

export class TicketService {
  /**
   * ĐẶT VÉ NÂNG CAO: Prisma $transaction hoàn hảo
   * Tự động Rollback hoàn tiền 100% nếu số ghế bị trùng hoặc phát sinh lỗi
   */
  static async bookTicketTransaction(
    userId: number,
    tripId: number,
    seatNumbers: number[], // 👈 Nhận mảng số ghế, VD: [11, 12, 13]
  ) {
    // Ép kiểu & lọc mảng ghế hợp lệ
    const cleanSeats = Array.from(
      new Set(seatNumbers.map((s) => Number(s))),
    ).filter((s) => !isNaN(s) && s > 0);

    if (cleanSeats.length === 0) {
      const error: any = new Error(
        "Vui lòng chọn ít nhất 1 vị trí ghế hợp lệ!",
      );
      error.statusCode = 400;
      throw error;
    }

    // 🎯 1. Tạo Batch ID và Request ID nhất quán cho đợt đặt vé này
    const batchId = `BOOK_${Date.now()}`;
    const requestId = `BOOK_TICKET_${Date.now()}`;

    return await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra chuyến xe
      const trip = await tx.trips.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        const error: any = new Error("Chuyến xe không tồn tại!");
        error.statusCode = 404;
        throw error;
      }

      // 2. Validate vị trí ghế xem có vượt quá tổng số ghế của xe không
      for (const seatNum of cleanSeats) {
        if (seatNum > trip.totalSeats) {
          const error: any = new Error(
            `Ghế số ${seatNum} vượt quá giới hạn xe (${trip.totalSeats} ghế)!`,
          );
          error.statusCode = 400;
          throw error;
        }
      }

      // 3. Tính tổng tiền của tất cả các ghế chọn
      const totalPrice = Number(trip.price) * cleanSeats.length;

      // 4. Kiểm tra ví người dùng
      const wallet = await tx.wallets.findUnique({
        where: { userId },
      });

      if (!wallet) {
        const error: any = new Error("Không tìm thấy ví người dùng!");
        error.statusCode = 404;
        throw error;
      }

      // 5. Kiểm tra số dư tài khoản cho TỔNG TIỀN
      if (wallet.balance.lessThan(totalPrice)) {
        const error: any = new Error(
          `Số dư ví không đủ! Cần ${totalPrice.toLocaleString("vi-VN")} VNĐ để mua ${cleanSeats.length} ghế.`,
        );
        error.statusCode = 400;
        throw error;
      }

      // 6. Trừ tiền ví (Trừ 1 lần cho tổng số ghế)
      const updatedWallet = await tx.wallets.update({
        where: { userId },
        data: {
          balance: {
            decrement: totalPrice,
          },
        },
      });

      // 🎯 Bổ sung batchId vào AuditLog để Admin UI hiển thị mã màu cam chuẩn xác
      await tx.auditLog.create({
        data: {
          requestId,
          userId,
          action: "BOOK_TICKET_PAYMENT",
          batchId, // 👈 ĐÃ BỔ SUNG BATCH ID VÀO ĐÂY
          resource: "Wallets",
          resourceId: String(wallet.id),
          newData: {
            amount: -totalPrice, // Tiền ra -> Âm
            description: `Thanh toán mua ${cleanSeats.length} vé ghế (${cleanSeats.join(", ")}) chuyến ${trip.route}`,
            tripId,
            seats: cleanSeats,
            batchId, // Lưu dự phòng vào JSON
          },
          isRevoked: false,
        },
      });

      // 7. Tạo MỖI GHẾ = 1 VÉ RECORD ĐỘC LẬP
      const createdTickets = [];

      try {
        for (const seatNum of cleanSeats) {
          await tx.tickets.deleteMany({
            where: {
              tripId,
              seatNumber: seatNum,
              status: { in: ["REVOKED_BY_ADMIN", "CANCELLED"] },
            },
          });
          const newTicket = await tx.tickets.create({
            data: {
              userId,
              tripId,
              seatNumber: seatNum, // 1 ghế / 1 vé (kiểu Int)
              status: "CONFIRMED",
              // batchId, // 👈 Bỏ comment dòng này nếu bảng Tickets trong schema.prisma của bạn có cột batchId
            },
            include: {
              trip: true,
            },
          });
          createdTickets.push(newTicket);
        }

        return {
          batchId, // 🎯 Trả về batchId cho client (Frontend)
          tickets: createdTickets,
          totalPaid: totalPrice,
          remainingBalance: updatedWallet.balance,
        };
      } catch (err: any) {
        // Ràng buộc @@unique([tripId, seatNumber]) phát hiện ghế đã bị đặt -> Rollback toàn bộ!
        if (err.code === "P2002") {
          const error: any = new Error(
            "Một hoặc nhiều ghế bạn chọn vừa có người khác đặt thành công. Vui lòng chọn ghế khác!",
          );
          error.statusCode = 409;
          throw error;
        }
        throw err;
      }
    });
  }

  static async getTicketsByUserId(userId: number) {
    return await prisma.tickets.findMany({
      where: { userId },
      include: {
        trip: {
          select: {
            route: true,
            departureAt: true,
            price: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
  static async cancelTicket(ticketId: number, userId: number) {
    // 1. Kiểm tra vé có tồn tại và thuộc về đúng User không
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true },
    });

    if (!ticket) {
      const error: any = new Error("Không tìm thấy thông tin vé!");
      error.statusCode = 404;
      throw error;
    }

    if (ticket.userId !== userId) {
      const error: any = new Error("Bạn không có quyền hủy chiếc vé này!");
      error.statusCode = 403;
      throw error;
    }

    if (ticket.status === "CANCELED") {
      const error: any = new Error("Vé này đã được hủy trước đó!");
      error.statusCode = 400;
      throw error;
    }

    if (ticket.status === "REVOKED_BY_ADMIN") {
      const error: any = new Error(
        "Vé đã bị Admin thu hồi, không thể thao tác!",
      );
      error.statusCode = 400;
      throw error;
    }
    // 🎯 LOGIC MỚI: CHẶN HỦY VÉ TRƯỚC 1 GIỜ KHỞI HÀNH
    const now = new Date().getTime();
    const departureTime = new Date(ticket.trip.departureAt).getTime();
    const ONE_HOUR_IN_MS = 60 * 60 * 1000;

    if (departureTime - now <= ONE_HOUR_IN_MS) {
      const error: any = new Error(
        "Không thể hủy vé! Hệ thống chỉ cho phép hủy vé trước giờ khởi hành ít nhất 1 tiếng.",
      );
      error.statusCode = 400;
      throw error;
    }
    const refundAmount = Number(ticket.trip.price);
    const requestId = `CANCEL_TICKET_${Date.now()}`;

    // 2. Thực thi Transaction: Cập nhật vé + Hoàn tiền ví + Ghi AuditLog
    return await prisma.$transaction(async (tx) => {
      // Đổi trạng thái vé thành CANCELED
      const updatedTicket = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "CANCELED" },
      });

      // Hoàn tiền lại vào ví của User
      const updatedWallet = await tx.wallets.update({
        where: { userId },
        data: {
          balance: {
            increment: refundAmount,
          },
        },
      });

      // Ghi nhật ký vào AuditLog
      await tx.auditLog.create({
        data: {
          requestId,
          userId,
          action: "CANCEL_TICKET_REFUND",
          resource: "Tickets",
          resourceId: String(ticketId),
          newData: { refundAmount, ticketStatus: "CANCELED" },
          isRevoked: false,
        },
      });

      return {
        ticket: updatedTicket,
        refundAmount,
        newBalance: updatedWallet.balance,
      };
    });
  }
}
