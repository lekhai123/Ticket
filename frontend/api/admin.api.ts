import axiosClient from "./axiosClient";
import type { ApiResponse, Trip } from "../types";

export const adminApi = {
  revokeBatch: async (payload: {
    batchId: string;
  }): Promise<ApiResponse<{ revokedCount: number }>> => {
    const res = await axiosClient.post<ApiResponse<{ revokedCount: number }>>(
      "/admin/revoke-batch",
      payload,
    );
    return res.data;
  },

  runReconciliation: async (): Promise<ApiResponse<any>> => {
    const res = await axiosClient.post<ApiResponse<any>>(
      "/admin/reconciliation/trigger",
      {}, // Tham số body (để trống)
      {
        timeout: 60000, // ✅ Cho phép chờ tối đa 60 giây
      },
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

  getTickets: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<any> => {
    const res = await axiosClient.get<any>("/admin/tickets", { params });
    return res.data;
  },

  scanTickets: async (): Promise<any> => {
    const res = await axiosClient.get<any>("/admin/tickets/scan");
    return res.data;
  },

  revokeTicket: async (ticketId: number, reason: string): Promise<any> => {
    const res = await axiosClient.post<any>(
      `/admin/bookings/${ticketId}/revoke`,
      { reason },
    );
    return res.data;
  },

  // THÊM HÀM NÀY ĐỂ LẤY CẢNH BÁO AI
  getAIAlerts: async (): Promise<any> => {
    const res = await axiosClient.get<any>("/admin/ai-alerts");
    return res.data;
  },
  revokeAnomalies: async (reason: string): Promise<any> => {
    const res = await axiosClient.post<any>("/admin/tickets/revoke-anomalies", {
      reason,
    });
    return res.data;
  },
};
