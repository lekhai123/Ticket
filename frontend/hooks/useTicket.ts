import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingApi, type CreateBookingPayload } from "../api/booking.api";

export const useTicket = () => {
  const queryClient = useQueryClient();

  const bookMutation = useMutation({
    mutationFn: (payload: CreateBookingPayload) =>
      bookingApi.createBooking(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["trip", variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["bookings", "my-tickets"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (ticketId: number) => bookingApi.cancelBooking(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "my-tickets"] });
    },
  });

  return {
    bookTicket: bookMutation.mutateAsync,
    isBooking: bookMutation.isPending,
    cancelTicket: cancelMutation.mutateAsync,
    isCanceling: cancelMutation.isPending,
  };
};
