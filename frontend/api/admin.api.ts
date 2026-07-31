import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export const adminApi = {
  revokeBatch: (payload: {
    batchId: string;
    adminUserId: number;
  }): Promise<ApiResponse<{ revokedCount: number }>> => {
    return axiosClient.post("/admin/revoke-batch", payload);
  },

  runReconciliation: (): Promise<ApiResponse<any[]>> => {
    return axiosClient.get("/admin/reconcile");
  },

  massGift: (payload: {
    targetType: string;
    targetId?: string;
    amount: number;
    batchId: string;
    reason: string;
  }): Promise<ApiResponse<{ successCount: number }>> => {
    return axiosClient.post("/admin/mass-gift", payload);
  },
};
