import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export const adminApi = {
  revokeBatch: async (payload: {
    batchId: string;
    adminUserId: number;
  }): Promise<ApiResponse<{ revokedCount: number }>> => {
    const res = await axiosClient.post<ApiResponse<{ revokedCount: number }>>(
      "/admin/revoke-batch",
      payload,
    );
    return res.data;
  },

  runReconciliation: async (): Promise<ApiResponse<any[]>> => {
    const res = await axiosClient.get<ApiResponse<any[]>>("/admin/reconcile");
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
};
