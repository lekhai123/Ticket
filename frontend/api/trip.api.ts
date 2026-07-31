import axiosClient from "./axiosClient";
import type { ApiResponse, Trip } from "../types";

export const tripApi = {
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
};
