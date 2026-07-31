import { useQuery } from "@tanstack/react-query";
import axiosClient from "../api/axiosClient";
import { healthApi } from "../api/health.api";

export const useAdminDashboard = () => {
  return useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: () =>
      axiosClient.get("/admin/dashboard-stats").then((res) => res.data),
    refetchInterval: 60000, // Tự động refetch mỗi 1 phút để cập nhật biểu đồ
  });
};

export const useSystemHealth = () => {
  return useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: () => healthApi.getHealthStatus().then((res) => res.data),
    refetchInterval: 15000, // Ping liên tục mỗi 15 giây để check server sống/chết
  });
};
