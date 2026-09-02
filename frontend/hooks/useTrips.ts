// FILE: hooks/useTrips.ts
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tripService } from "../services/trip.service";
import type { Trip } from "../types";

export const useTrips = () => {
  const queryClient = useQueryClient();
  const [searchResults, setSearchResults] = useState<Trip[] | null>(null);

  const defaultTripsQuery = useQuery<Trip[], Error>({
    queryKey: ["trips", "default"],
    queryFn: async () => {
      const res: any = await tripService.getAllTrips();
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    },
    staleTime: 5 * 1000, // 👈 Dữ liệu chỉ giữ tươi 5s để phản ánh số chỗ tức thì
    refetchOnWindowFocus: true, // 👈 Tự động tải lại số ghế khi chuyển tab quay lại
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

  const trips: Trip[] = searchResults ?? defaultTripsQuery.data ?? [];

  return {
    trips,
    searchTrips: handleSearch,
    clearSearch,
    isSearching: semanticSearchMutation.isPending,
    isLoading: defaultTripsQuery.isLoading || semanticSearchMutation.isPending,
    error: semanticSearchMutation.error || defaultTripsQuery.error,
    refetchDefault: defaultTripsQuery.refetch,
  };
};
