import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketApi, type BookTicketPayload } from "../api/ticket.api";

export const useTicket = () => {
  const queryClient = useQueryClient();

  const bookMutation = useMutation({
    mutationFn: (payload: BookTicketPayload) => ticketApi.bookTicket(payload),
    onSuccess: (_, variables) => {
      // Invalidate cache ví và chuyến xe để cập nhật UI
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["trip", variables.tripId] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "my-tickets"] });
    },
  });

  return {
    bookTicket: bookMutation.mutateAsync,
    isBooking: bookMutation.isPending,
  };
};
