import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingApi, type CreateBookingPayload } from "../api/booking.api";

export const useTicket = () => {
  const queryClient = useQueryClient();

  const bookMutation = useMutation({
    mutationFn: (payload: CreateBookingPayload) =>
      bookingApi.createBooking(payload),
    onSuccess: (_, variables) => {
      // Dùng key gốc ["wallet"] và ["my-tickets"] để xóa TẤT CẢ các cache con liên quan
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["trip", variables.tripId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (ticketId: number) => bookingApi.cancelBooking(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] }); // Cập nhật lại danh sách chuyến đi
    },
  });

  return {
    bookTicket: bookMutation.mutateAsync,
    isBooking: bookMutation.isPending,
    cancelTicket: cancelMutation.mutateAsync,
    isCanceling: cancelMutation.isPending,
  };
};
