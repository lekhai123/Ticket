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
      return (
        (res.data as any)?.logs ||
        (res.data as any)?.data?.logs ||
        (Array.isArray(res.data) ? res.data : [])
      );
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
