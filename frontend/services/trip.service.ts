import { tripApi } from "../api/trip.api";

export const tripService = {
  semanticSearch: (prompt: string) => {
    return tripApi.semanticSearch(prompt);
  },

  getAllTrips: () => {
    return tripApi.getAllTrips();
  },

  getById: (id: number | string) => {
    return tripApi.getById(id);
  },
};
