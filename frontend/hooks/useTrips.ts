import { useMutation, useQuery } from "@tanstack/react-query";
import { tripService } from "../services/trip.service";
import type { Trip } from "../types";

export const useTrips = () => {
  // tripService.getAllTrips() đã trả về trực tiếp Trip[]
  const defaultTripsQuery = useQuery<Trip[], Error>({
    queryKey: ["trips", "default"],
    queryFn: () => tripService.getAllTrips(),
  });

  const semanticSearchMutation = useMutation<Trip[], Error, string>({
    mutationFn: (prompt: string) => tripService.semanticSearch(prompt),
  });

  // Ưu tiên dữ liệu từ kết quả Semantic Search nếu có
  const trips = (semanticSearchMutation.data ??
    defaultTripsQuery.data ??
    []) as Trip[];

  return {
    semanticSearch: semanticSearchMutation.mutateAsync,
    isSearching:
      semanticSearchMutation.isPending || defaultTripsQuery.isLoading,
    trips,
    error: semanticSearchMutation.error || defaultTripsQuery.error,
    refetchDefault: defaultTripsQuery.refetch,
  };
};
