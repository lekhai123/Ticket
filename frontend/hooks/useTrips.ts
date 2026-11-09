import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tripService } from "../services/trip.service";
import type { Trip } from "../types";

export const useTrips = () => {
  const queryClient = useQueryClient();
  const [searchResults, setSearchResults] = useState<Trip[] | null>(null);
  const [page, setPage] = useState(1); // State quản lý trang hiện tại

  //thêm page vào queryKey và truyền page vào API
  const defaultTripsQuery = useQuery<Trip[], Error>({
    queryKey: ["trips", "default", page],
    queryFn: async () => {
      const res: any = await tripService.getAllTrips(page, 12);
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    },
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
  });

  const semanticSearchMutation = useMutation<Trip[], Error, string>({
    mutationFn: async (prompt: string) => {
      const res: any = await tripService.semanticSearch(prompt);
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });

  const handleSearch = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setSearchResults(null);
      await queryClient.invalidateQueries({ queryKey: ["trips", "default"] });
      return;
    }
    await semanticSearchMutation.mutateAsync(trimmed);
  };

  const clearSearch = () => {
    setSearchResults(null);
    semanticSearchMutation.reset();
  };

  // hàm chuyển trang tự động cuộn lên đầu
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const trips: Trip[] = searchResults ?? defaultTripsQuery.data ?? [];

  return {
    trips,
    searchTrips: handleSearch,
    clearSearch,
    isSearching: semanticSearchMutation.isPending,
    isLoading: defaultTripsQuery.isLoading || semanticSearchMutation.isPending,
    error: semanticSearchMutation.error || defaultTripsQuery.error,
    refetchDefault: defaultTripsQuery.refetch,
    page,
    setPage: handlePageChange,
    isSearchMode: !!searchResults, //cờ báo hiệu đang trong chế độ tìm kiếm
  };
};
