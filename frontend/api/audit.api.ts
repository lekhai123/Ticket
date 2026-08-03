import axiosClient from "./axiosClient";
import type { ApiResponse, AuditLog } from "../types";

export const auditApi = {
  getLogs: async (params?: {
    action?: string;
    batchId?: string;
    search?: string;
  }): Promise<ApiResponse<AuditLog[]>> => {
    const res = await axiosClient.get<ApiResponse<AuditLog[]>>(
      "/admin/audit-logs",
      {
        params,
      },
    );
    return res.data;
  },
};
