import prisma from "../database/prismaClient";

export class TicketService {
  /**
   * ĐẶT VÉ NÂNG CAO: Prisma $transaction
   * Tự động Rollback hoàn tiền 100% nếu số ghế bị trùng hoặc phát sinh lỗi
   */
  static async bookTicketTransaction(
    userId: number,
    tripId: number,
    seatNumbers: number[], //Nhận mảng số ghế, VD: [11, 12, 13]
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

    //Tạo Batch ID và Request ID nhất quán cho đợt đặt vé này
    const batchId = `BOOK_${Date.now()}`;
    const requestId = `BOOK_TICKET_${Date.now()}`;

    return await prisma.$transaction(async (tx) => {
      const trip = await tx.trips.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        const error: any = new Error("Chuyến xe không tồn tại!");
        error.statusCode = 404;
        throw error;
      }

      // Validate vị trí ghế xem có vượt quá tổng số ghế của xe không
      for (const seatNum of cleanSeats) {
        if (seatNum > trip.totalSeats) {
          const error: any = new Error(
            `Ghế số ${seatNum} vượt quá giới hạn xe (${trip.totalSeats} ghế)!`,
          );
          error.statusCode = 400;
          throw error;
        }
      }
      const totalPrice = Number(trip.price) * cleanSeats.length;
      const wallet = await tx.wallets.findUnique({
        where: { userId },
      });

      if (!wallet) {
        const error: any = new Error("Không tìm thấy ví người dùng!");
        error.statusCode = 404;
        throw error;
      }

      if (wallet.balance.lessThan(totalPrice)) {
        const error: any = new Error(
          `Số dư ví không đủ! Cần ${totalPrice.toLocaleString("vi-VN")} VNĐ để mua ${cleanSeats.length} ghế.`,
        );
        error.statusCode = 400;
        throw error;
      }
      const updatedWallet = await tx.wallets.update({
        where: { userId },
        data: {
          balance: {
            decrement: totalPrice,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          requestId,
          userId,
          action: "BOOK_TICKET_PAYMENT",
          batchId,
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
            },
            include: {
              trip: true,
            },
          });
          createdTickets.push(newTicket);
        }

        return {
          batchId,
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
    const tickets = await prisma.tickets.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        seatNumber: true,
        status: true,
        createdAt: true,
        trip: {
          select: {
            id: true,
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

    return tickets.map((ticket) => ({
      ...ticket,
      trip: ticket.trip
        ? {
            ...ticket.trip,
            price: Number(ticket.trip.price),
          }
        : null,
    }));
  }
  static async cancelTicket(ticketId: number, userId: number) {
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
    // CHẶN HỦY VÉ TRƯỚC 1 GIỜ KHỞI HÀNH
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

    //Thực thi Transaction: Cập nhật vé + Hoàn tiền ví + Ghi AuditLog
    return await prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "CANCELED" },
      });

      const updatedWallet = await tx.wallets.update({
        where: { userId },
        data: {
          balance: {
            increment: refundAmount,
          },
        },
      });

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
