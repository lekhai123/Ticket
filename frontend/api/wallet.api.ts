import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export const walletApi = {
  getBalance: async (
    userId: number,
  ): Promise<ApiResponse<{ balance: number }>> => {
    const res = await axiosClient.get<ApiResponse<{ balance: number }>>(
      `/wallets/${userId}`,
    );
    return res.data;
  },

  topUp: async (
    userId: number,
    payload: { amount: number; action?: string; batchId?: string },
  ): Promise<ApiResponse<{ newBalance: number }>> => {
    const res = await axiosClient.post<ApiResponse<{ newBalance: number }>>(
      `/wallets/${userId}/topup`,
      payload,
    );
    return res.data;
  },

  getTransactions: async (
    userId: number,
    params?: any,
  ): Promise<ApiResponse<any[]>> => {
    const res = await axiosClient.get<ApiResponse<any[]>>(
      `/wallets/${userId}/transactions`,
      { params },
    );
    return res.data;
  },
};
