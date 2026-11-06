import axiosClient from "./axiosClient";
import type { ApiResponse, Trip } from "../types";
export const adminApi = {
  revokeBatch: async (payload: {
    batchId: string;
  }): Promise<ApiResponse<{ revokedCount: number }>> => {
    // Đã bỏ adminUserId khỏi payload
    const res = await axiosClient.post<ApiResponse<{ revokedCount: number }>>(
      "/admin/revoke-batch",
      payload,
    );
    return res.data;
  },

  runReconciliation: async (): Promise<ApiResponse<any>> => {
    // Đổi thành POST và đúng route
    const res = await axiosClient.post<ApiResponse<any>>(
      "/admin/reconciliation/trigger",
    );
    return res.data;
  },

  massGift: async (payload: {
    targetType: string;
    targetId?: string;
    amount: number;
    batchId: string;
    reason: string;
  }): Promise<ApiResponse<{ successCount: number }>> => {
    const res = await axiosClient.post<ApiResponse<{ successCount: number }>>(
      "/admin/mass-gift",
      payload,
    );
    return res.data;
  },
  unlockWallet: async (userId: number): Promise<ApiResponse<any>> => {
    const res = await axiosClient.patch<ApiResponse<any>>(
      `/admin/wallets/${userId}/unlock`,
    );
    return res.data;
  },
};
