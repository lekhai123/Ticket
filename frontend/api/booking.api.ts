import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export interface CreateBookingPayload {
  tripId: number | string;
  seatNumber: number; // BE chỉ nhận seatNumber (số ít)
  paymentMethod?: "WALLET" | "LATER";
}

export const bookingApi = {
  // Đặt vé
  createBooking: async (
    payload: CreateBookingPayload,
  ): Promise<ApiResponse<any>> => {
    const res = await axiosClient.post<ApiResponse<any>>("/bookings", payload);
    return res.data;
  },

  // Lấy danh sách vé
  getMyTickets: async (): Promise<ApiResponse<any>> => {
    const res = await axiosClient.get<ApiResponse<any>>("/bookings/my-tickets");
    return res.data;
  },

  // Hủy vé
  cancelBooking: async (ticketId: number): Promise<ApiResponse<any>> => {
    const res = await axiosClient.delete<ApiResponse<any>>(
      `/bookings/${ticketId}`,
    );
    return res.data;
  },
};
