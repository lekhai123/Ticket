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
  getHealthStatus: (): Promise<ApiResponse<SystemHealthData>> => {
    return axiosClient.get("/admin/system-health");
  },
};
