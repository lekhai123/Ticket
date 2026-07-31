import axiosClient from "./axiosClient";
import type { ApiResponse, AuditLog } from "../types";

export const auditApi = {
  getLogs: (params?: {
    action?: string;
    batchId?: string;
    search?: string;
  }): Promise<ApiResponse<AuditLog[]>> => {
    return axiosClient.get("/admin/audit-logs", { params });
  },
};
