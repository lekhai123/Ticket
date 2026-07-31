import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export interface BookTicketPayload {
  tripId: number | string;
  seatNumbers?: number[]; // 👈 Khớp với Payload mới ở Booking.tsx
  seatIds?: string[]; // Giữ lại để tương thích ngược nếu cần
  paymentMethod?: "WALLET" | "LATER";
}

export const ticketApi = {
  // 1. Đặt vé (Trừ tiền ví + Redis Lock)
  bookTicket: (payload: BookTicketPayload): Promise<ApiResponse<any>> => {
    return axiosClient.post("/tickets/book", payload);
  },

  // 2. Lấy danh sách vé đã đặt của User (Dùng cho tab "Vé của tôi" trong Profile)
  getUserTickets: (): Promise<ApiResponse<any>> => {
    return axiosClient.get("/tickets/my-tickets");
  },

  // 3. Khách hàng hủy vé (Hoàn tiền lại vào Ví)
  cancelTicket: (ticketId: number): Promise<ApiResponse<any>> => {
    return axiosClient.patch(`/tickets/${ticketId}/cancel`);
  },
};
