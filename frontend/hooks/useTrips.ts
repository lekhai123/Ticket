// FILE: hooks/useTrips.ts
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { tripService } from "../services/trip.service";
import type { Trip } from "../types";

export const useTrips = () => {
  // Quản lý kết quả search AI riêng biệt để có thể reset về danh sách gốc
  const [searchResults, setSearchResults] = useState<Trip[] | null>(null);

  // 1. Query danh sách chuyến đi mặc định
  const defaultTripsQuery = useQuery<Trip[], Error>({
    queryKey: ["trips", "default"],
    queryFn: async () => {
      const res: any = await tripService.getAllTrips();
      // Đảm bảo luôn trả về mảng Trip[] dù service có bọc .data hay không
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    },
    staleTime: 60 * 1000, // Giữ tươi trong 1 phút
  });

  // 2. Mutation tìm kiếm AI
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

  // Hàm tìm kiếm bọc ngoài: nếu xóa trắng ô input -> tự reset về danh sách mặc định
  const handleSemanticSearch = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setSearchResults(null);
      return defaultTripsQuery.data || [];
    }
    return await semanticSearchMutation.mutateAsync(trimmed);
  };

  // Hàm chủ động xóa kết quả tìm kiếm AI để trở về danh sách gốc
  const clearSearch = () => {
    setSearchResults(null);
    semanticSearchMutation.reset();
  };

  // Ưu tiên hiển thị kết quả AI nếu đang active, ngược lại hiển thị danh sách mặc định
  const trips: Trip[] = searchResults ?? defaultTripsQuery.data ?? [];

  return {
    trips,
    semanticSearch: handleSemanticSearch,
    clearSearch,
    isSearching: semanticSearchMutation.isPending,
    isLoadingDefault: defaultTripsQuery.isLoading,
    isLoading: semanticSearchMutation.isPending || defaultTripsQuery.isLoading,
    error: semanticSearchMutation.error || defaultTripsQuery.error,
    refetchDefault: defaultTripsQuery.refetch,
  };
};
