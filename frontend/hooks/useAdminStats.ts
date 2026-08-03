import { useQuery } from "@tanstack/react-query";
import axiosClient from "../api/axiosClient";
import { healthApi } from "../api/health.api";

export const useAdminDashboard = () => {
  return useQuery({
    queryKey: ["admin", "dashboard-stats"],
    queryFn: async () => {
      const res = await axiosClient.get("/admin/dashboard-stats");
      return res.data;
    },
    refetchInterval: 60000,
  });
};

export const useSystemHealth = () => {
  return useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: async () => {
      const res = await healthApi.getHealthStatus();
      return res.data; // Lấy dữ liệu SystemHealthData từ ApiResponse
    },
    refetchInterval: 15000,
  });
};
