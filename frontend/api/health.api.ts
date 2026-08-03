import axiosClient from "./axiosClient";
import type { ApiResponse } from "../types";

export interface SystemHealthData {
  services: {
    name: string;
    status: "operational" | "degraded" | "outage";
    latency: number;
  }[];
}

export const healthApi = {
  getHealthStatus: async (): Promise<ApiResponse<SystemHealthData>> => {
    const res = await axiosClient.get<ApiResponse<SystemHealthData>>(
      "/admin/system-health",
    );
    return res.data;
  },
};
