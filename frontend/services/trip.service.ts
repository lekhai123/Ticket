import { tripApi } from "../api/trip.api";

export const tripService = {
  semanticSearch: (prompt: string) => {
    return tripApi.semanticSearch(prompt);
  },

  getAllTrips: (page: number = 1, limit: number = 12) => {
    return tripApi.getAllTrips(page, limit);
  },

  getById: (id: number | string) => {
    return tripApi.getById(id);
  },
};
