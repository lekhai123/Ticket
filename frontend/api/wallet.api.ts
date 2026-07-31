import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export const walletApi = {
  getBalance: (userId: number): Promise<ApiResponse<{ balance: number }>> => {
    return axiosClient.get(`/wallets/${userId}`);
  },

  topUp: (
    userId: number,
    payload: { amount: number; action?: string; batchId?: string },
  ): Promise<ApiResponse<{ newBalance: number }>> => {
    return axiosClient.post(`/wallets/${userId}/topup`, payload);
  },

  getTransactions: (
    userId: number,
    params?: any,
  ): Promise<ApiResponse<any[]>> => {
    return axiosClient.get(`/wallets/${userId}/transactions`, { params });
  },
};
