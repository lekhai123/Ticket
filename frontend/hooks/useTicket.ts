// src/hooks/useTicket.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketApi } from "../api/ticket.api";

export const useTicket = () => {
  const queryClient = useQueryClient();

  const bookMutation = useMutation({
    mutationFn: ticketApi.bookTicket,
    onSuccess: (data, variables) => {
      // Đặt vé xong phải cập nhật lại Ví và Trạng thái chuyến xe
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["trip", variables.tripId] });
    },
  });

  return {
    bookTicket: bookMutation.mutateAsync,
    isBooking: bookMutation.isPending,
  };
};

