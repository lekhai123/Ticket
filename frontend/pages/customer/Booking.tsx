import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bus, Wallet, AlertCircle } from "lucide-react";
import { tripApi } from "../../api/trip.api";
import { useWallet } from "../../hooks/useWallet";
import { useTicket } from "../../hooks/useTicket";
import { useAuthStore } from "../../store/authStore";
import { formatCurrency } from "../../utils/format";
import { cn } from "../../utils/cn";
import { Button } from "../../components/ui/Button";

export default function Booking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  // 1. Fetch chuyến xe thực tế theo ID
  const { data: trip, isLoading: isTripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => {
      if (!id) return null;

      return await tripApi.getById(id);
    },
    enabled: !!id,
  });

  // 2. Fetch số dư ví
  const { balance, isLoadingBalance } = useWallet(user?.id || 0);
  const { bookTicket, isBooking } = useTicket();

  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  // Bóc tách tên tuyến xe
  const [origin, destination] = trip?.route
    ? trip.route.split(" - ")
    : [trip?.origin || "--", trip?.destination || "--"];

  // 3. Render danh sách 30 ghế xe từ Backend
  const bookedSeatNumbers: number[] =
    trip?.tickets
      ?.filter((t: any) => ["HELD", "PENDING", "CONFIRMED"].includes(t.status))
      .map((t: any) => Number(t.seatNumber)) || [];

  const seatsFloor1 = Array.from({ length: 15 }, (_, i) => ({
    seatNumber: i + 1,
    isBooked: bookedSeatNumbers.includes(i + 1),
  }));

  const seatsFloor2 = Array.from({ length: 15 }, (_, i) => ({
    seatNumber: i + 16,
    isBooked: bookedSeatNumbers.includes(i + 16),
  }));

  const handleToggleSeat = (seatNum: number, isBooked: boolean) => {
    if (isBooked) return;
    setSelectedSeats((prev) =>
      prev.includes(seatNum)
        ? prev.filter((s) => s !== seatNum)
        : [...prev, seatNum],
    );
  };

  const unitPrice = Number(trip?.price || 0);
  const totalPrice = selectedSeats.length * unitPrice;
  const rawBalance = Number(balance?.raw || 0);
  const canAfford = rawBalance >= totalPrice;

  // 4. Xử lý đặt vé (Gửi 1 mảng tất cả các ghế đã chọn)
  const handleConfirmBooking = async () => {
    if (!canAfford || selectedSeats.length === 0 || !id) return;

    try {
      await bookTicket({
        tripId: Number(id),
        seatNumbers: selectedSeats, // 👈 Gửi cả mảng [11, 12] lên Backend
        paymentMethod: "WALLET",
      } as any);

      // 🎯 Xóa cache để làm tươi sơ đồ ghế & Ví điện tử
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });

      alert(`Thanh toán thành công ${selectedSeats.length} vé từ Ví!`);
      navigate("/customer/wallet");
    } catch (err: any) {
      alert(
        err.response?.data?.message || err.message || "Thanh toán thất bại.",
      );
    }
  };

  if (isTripLoading)
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sơ đồ 30 ghế xe khách */}
      <div className="col-span-1 lg:col-span-2 space-y-8">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bus className="h-6 w-6 text-indigo-500" /> Sơ đồ chọn ghế (Xe 30 chỗ)
        </h2>
        <div className="flex gap-8 overflow-x-auto pb-4 custom-scrollbar">
          <SeatFloor
            title="Tầng Dưới (Ghế 1 - 15)"
            seats={seatsFloor1}
            selected={selectedSeats}
            onSelect={handleToggleSeat}
          />
          <SeatFloor
            title="Tầng Trên (Ghế 16 - 30)"
            seats={seatsFloor2}
            selected={selectedSeats}
            onSelect={handleToggleSeat}
          />
        </div>
      </div>

      {/* Box Thanh Toán & Ví */}
      <div className="relative">
        <div className="sticky top-24 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-xl font-semibold mb-6 border-b border-zinc-100 pb-4 dark:border-zinc-800">
            Thông tin thanh toán
          </h3>

          <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 mb-8">
            <div className="flex justify-between">
              <span>Tuyến đi:</span>
              <span className="font-medium text-zinc-900 dark:text-white">
                {origin} ➔ {destination}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ghế đã chọn:</span>
              <span className="font-medium text-zinc-900 dark:text-white">
                {selectedSeats.length > 0
                  ? selectedSeats.map((s) => `A${s}`).join(", ")
                  : "Chưa chọn ghế"}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-4 text-lg dark:border-zinc-800">
              <span>Tổng thanh toán:</span>
              <span className="font-bold text-indigo-600">
                {formatCurrency(totalPrice)}
              </span>
            </div>
          </div>

          {/* Thông tin số dư ví */}
          <div className="rounded-xl bg-zinc-100 p-4 mb-6 dark:bg-zinc-900">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="h-5 w-5 text-indigo-500" />
              <span className="font-medium text-sm">Số dư Ví cá nhân</span>
            </div>
            <div className="text-2xl font-bold text-emerald-500">
              {isLoadingBalance ? "..." : formatCurrency(rawBalance)}
            </div>
            {!canAfford && selectedSeats.length > 0 && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1 font-medium">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> Số dư ví
                không đủ. Vui lòng nạp thêm tiền!
              </p>
            )}
          </div>

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={selectedSeats.length === 0 || !canAfford}
            isLoading={isBooking}
            onClick={handleConfirmBooking}
          >
            Thanh toán bằng Ví ngay
          </Button>
        </div>
      </div>
    </div>
  );
}

function SeatFloor({
  title,
  seats,
  selected,
  onSelect,
}: {
  title: string;
  seats: { seatNumber: number; isBooked: boolean }[];
  selected: number[];
  onSelect: (seatNum: number, isBooked: boolean) => void;
}) {
  return (
    <div className="flex-none w-64 rounded-2xl bg-zinc-100 p-6 dark:bg-zinc-900/50">
      <h4 className="text-center font-semibold text-sm mb-6 text-zinc-500">
        {title}
      </h4>
      <div className="grid grid-cols-3 gap-3">
        {seats.map((seat) => {
          const isSelected = selected.includes(seat.seatNumber);
          return (
            <button
              key={seat.seatNumber}
              type="button"
              disabled={seat.isBooked}
              onClick={() => onSelect(seat.seatNumber, seat.isBooked)}
              className={cn(
                "h-14 rounded-xl border-2 flex flex-col items-center justify-center text-xs font-bold transition-all",
                seat.isBooked
                  ? "bg-zinc-200 border-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-800"
                  : isSelected
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105"
                    : "bg-white border-zinc-300 hover:border-indigo-400 text-zinc-800 dark:bg-zinc-950 dark:border-zinc-700 dark:text-zinc-200",
              )}
            >
              <span>A{seat.seatNumber}</span>
              <span className="text-[10px] font-normal opacity-80">
                {seat.isBooked ? "Đã đặt" : isSelected ? "Đã chọn" : "Trống"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
