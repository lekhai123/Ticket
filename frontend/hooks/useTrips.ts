import { useMutation, useQuery } from "@tanstack/react-query";
import { tripService } from "../services/trip.service";
import type { Trip } from "../types";

export const useTrips = () => {
  // 1. Query lấy danh sách chuyến xe mặc định/ban đầu khi vừa load trang
  const defaultTripsQuery = useQuery<Trip[], Error>({
    queryKey: ["trips", "default"],
    queryFn: () => tripService.getAllTrips(), // ĐỔI SANG GỌI GE TALL TRIPS
  });

  // 2. Mutation cho Tìm kiếm AI (như code cũ)
  const semanticSearchMutation = useMutation<Trip[], Error, string>({
    mutationFn: (prompt: string) => tripService.semanticSearch(prompt),
  });

  // Uu tiên lấy kết quả từ Semantic Search nếu đã search, nếu chưa thì lấy danh sách mặc định
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
