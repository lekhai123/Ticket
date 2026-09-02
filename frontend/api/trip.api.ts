// FILE: frontend/api/trip.api.ts
import axiosClient from "./axiosClient";
import type { ApiResponse, Trip } from "../types";

// Re-export để các component import từ trip.api vẫn dùng được
export type { Trip };

export const tripApi = {
  async getAll(): Promise<Trip[]> {
    const res = await axiosClient.get<ApiResponse<Trip[]>>("/trips");
    return res.data.data;
  },

  async getAllTrips(): Promise<Trip[]> {
    const res = await axiosClient.get<ApiResponse<Trip[]>>("/trips");
    return res.data.data;
  },

  async search(params: {
    origin?: string;
    destination?: string;
    date?: string;
  }): Promise<Trip[]> {
    const res = await axiosClient.get<ApiResponse<Trip[]>>("/trips/search", {
      params,
    });
    return res.data.data;
  },

  async semanticSearch(prompt: string): Promise<Trip[]> {
    const res = await axiosClient.post<ApiResponse<Trip[]>>(
      "/trips/semantic-search",
      { prompt },
    );
    return res.data.data;
  },

  async getById(id: number | string): Promise<Trip> {
    const res = await axiosClient.get<ApiResponse<Trip>>(`/trips/${id}`);
    return res.data.data;
  },

  async create(payload: {
    route: string;
    description?: string;
    departureAt: string;
    price: number;
    totalSeats?: number;
  }): Promise<Trip> {
    const res = await axiosClient.post<ApiResponse<Trip>>("/trips", payload);
    return res.data.data;
  },

  async update(id: number | string, payload: Partial<Trip>): Promise<Trip> {
    const res = await axiosClient.patch<ApiResponse<Trip>>(
      `/trips/${id}`,
      payload,
    );
    return res.data.data;
  },

  async delete(id: number | string): Promise<void> {
    await axiosClient.delete(`/trips/${id}`);
  },
};
