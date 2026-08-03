import { useQuery } from "@tanstack/react-query";
import { auditApi } from "../api/audit.api";

export const useAuditLogs = (filters?: {
  action?: string;
  batchId?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const res = await auditApi.getLogs(filters);

      // 🎯 Bóc tách và trả về trực tiếp mảng logs từ Object response
      return (
        (res.data as any)?.logs ||
        (res.data as any)?.data?.logs ||
        (Array.isArray(res.data) ? res.data : [])
      );
    },
  });
};
