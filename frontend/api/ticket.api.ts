import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export interface BookTicketPayload {
  tripId: number | string;
  seatNumbers?: number[];
  seatIds?: string[];
  paymentMethod?: "WALLET" | "LATER";
}

export const ticketApi = {
  // 1. Đặt vé
  bookTicket: async (payload: BookTicketPayload): Promise<ApiResponse<any>> => {
    const res = await axiosClient.post<ApiResponse<any>>(
      "/tickets/book",
      payload,
    );
    return res.data;
  },

  // 2. Lấy danh sách vé đã đặt của User
  getUserTickets: async (): Promise<ApiResponse<any>> => {
    const res = await axiosClient.get<ApiResponse<any>>("/tickets/my-tickets");
    return res.data;
  },

  // 3. Khách hàng hủy vé
  cancelTicket: async (ticketId: number): Promise<ApiResponse<any>> => {
    const res = await axiosClient.patch<ApiResponse<any>>(
      `/tickets/${ticketId}/cancel`,
    );
    return res.data;
  },
};
