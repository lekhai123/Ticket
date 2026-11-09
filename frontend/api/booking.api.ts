import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export interface CreateBookingPayload {
  tripId: number | string;
  seatNumbers: number[];
  paymentMethod?: "WALLET" | "LATER";
  batchId?: string;
}

export const bookingApi = {
  createBooking: async (
    payload: CreateBookingPayload,
  ): Promise<ApiResponse<any>> => {
    const res = await axiosClient.post<ApiResponse<any>>("/bookings", payload);
    return res.data;
  },

  getMyTickets: async (
    page: number = 1,
    limit: number = 5,
  ): Promise<ApiResponse<any>> => {
    const res = await axiosClient.get<ApiResponse<any>>(
      `/bookings/my-tickets?page=${page}&limit=${limit}`,
    );
    return res.data;
  },

  cancelBooking: async (ticketId: number): Promise<ApiResponse<any>> => {
    const res = await axiosClient.delete<ApiResponse<any>>(
      `/bookings/${ticketId}`,
    );
    return res.data;
  },
};
