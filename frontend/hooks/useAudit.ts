import { useQuery } from "@tanstack/react-query";
import { auditApi } from "../api/audit.api";

export const useAuditLogs = (filters: any) => {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => auditApi.getLogs(filters).then((res) => res.data),
  });
};
