import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bus, Wallet, AlertCircle, Lock, LockKeyhole } from "lucide-react";
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

  const [lockedWalletModal, setLockedWalletModal] = useState({
    isOpen: false,
    message: "",
  });
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  const { data: trip, isLoading: isTripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => (id ? await tripApi.getById(id) : null),
    enabled: !!id,
  });

  const { balance, isLoadingBalance } = useWallet(user?.id || 0);
  const { bookTicket, isBooking } = useTicket();

  const [origin, destination] = trip?.route
    ? trip.route.split(" - ")
    : ["--", "--"];
  const totalSeats = Number(trip?.totalSeats) || 30;

  const bookedSeatNumbers: number[] = useMemo(() => {
    if (trip?.bookedSeatNumbers && Array.isArray(trip.bookedSeatNumbers))
      return trip.bookedSeatNumbers.map(Number);
    return (
      trip?.tickets
        ?.filter((t: any) =>
          ["HELD", "PENDING", "CONFIRMED"].includes(t.status),
        )
        .map((t: any) => Number(t.seatNumber)) || []
    );
  }, [trip]);

  const halfSeats = Math.ceil(totalSeats / 2);
  const seatsFloor1 = useMemo(
    () =>
      Array.from({ length: halfSeats }, (_, i) => ({
        seatNumber: i + 1,
        isBooked: bookedSeatNumbers.includes(i + 1),
      })),
    [halfSeats, bookedSeatNumbers],
  );
  const seatsFloor2 = useMemo(
    () =>
      Array.from({ length: totalSeats - halfSeats }, (_, i) => ({
        seatNumber: halfSeats + i + 1,
        isBooked: bookedSeatNumbers.includes(halfSeats + i + 1),
      })),
    [totalSeats, halfSeats, bookedSeatNumbers],
  );

  const availableSeatsCount = Math.max(
    0,
    totalSeats - bookedSeatNumbers.length,
  );

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

  const isWalletLocked = Boolean((balance as any)?.isLocked);
  const isDebt = rawBalance < 0;
  const canAfford = rawBalance >= totalPrice && !isWalletLocked && !isDebt;

  const handleConfirmBooking = async () => {
    if (!canAfford || selectedSeats.length === 0 || !id) return;
    try {
      await bookTicket({
        tripId: Number(id),
        seatNumbers: selectedSeats,
        paymentMethod: "WALLET",
      } as any);
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      alert(`Thanh toán thành công ${selectedSeats.length} vé từ Ví!`);
      navigate("/customer/wallet");
    } catch (err: any) {
      const errResponse = err.response?.data;
      if (
        err.response?.status === 403 ||
        errResponse?.code === "WALLET_LOCKED_OR_DEBT"
      ) {
        setLockedWalletModal({
          isOpen: true,
          message:
            errResponse?.message ||
            "Ví đang bị khóa do dính chênh lệch tài chính/ghi nợ âm.",
        });
        return;
      }
      alert(errResponse?.message || err.message || "Thanh toán thất bại.");
    }
  };

  if (isTripLoading)
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#8B5CF6] border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="col-span-1 lg:col-span-2 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-[#F5F5F7]">
            <Bus className="h-5 w-5 text-[#8B5CF6]" /> Sơ đồ chọn ghế
          </h2>
          <span
            className={cn(
              "text-xs font-medium px-3 py-1.5 rounded-full border",
              availableSeatsCount === 0
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            )}
          >
            Còn trống: {availableSeatsCount} / {totalSeats} chỗ
          </span>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
          <SeatFloor
            title={`Tầng Dưới (1 - ${halfSeats})`}
            seats={seatsFloor1}
            selected={selectedSeats}
            onSelect={handleToggleSeat}
          />
          <SeatFloor
            title={`Tầng Trên (${halfSeats + 1} - ${totalSeats})`}
            seats={seatsFloor2}
            selected={selectedSeats}
            onSelect={handleToggleSeat}
          />
        </div>

        <div className="flex items-center gap-6 pt-2 text-xs text-[#92929F]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-white/[0.08] bg-[#15151B]" />{" "}
            Ghế trống
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#8B5CF6] border border-[#8B5CF6]" />{" "}
            Đang chọn
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#0D0D10] border border-white/[0.08]" />{" "}
            Đã đặt
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="sticky top-24 rounded-3xl border border-white/[0.08] bg-[#15151B] p-6">
          <h3 className="text-lg font-medium mb-6 border-b border-white/[0.08] pb-4 text-[#F5F5F7]">
            Thông tin thanh toán
          </h3>
          <div className="space-y-3 text-sm text-[#92929F] mb-8">
            <div className="flex justify-between">
              <span>Tuyến đi:</span>
              <span className="font-medium text-[#F5F5F7]">
                {origin} ➔ {destination}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Đơn giá:</span>
              <span className="font-medium text-[#F5F5F7]">
                {formatCurrency(unitPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Ghế đã chọn:</span>
              <span className="font-medium text-[#F5F5F7]">
                {selectedSeats.length > 0
                  ? selectedSeats.map((s) => `A${s}`).join(", ")
                  : "Chưa chọn"}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/[0.08] pt-4 text-base">
              <span className="text-[#F5F5F7]">Tổng thanh toán:</span>
              <span className="font-semibold text-[#8B5CF6] text-lg">
                {formatCurrency(totalPrice)}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "rounded-xl p-4 mb-6 transition-all border",
              isWalletLocked || isDebt
                ? "bg-rose-500/10 border-rose-500/20"
                : "bg-[#0D0D10] border-white/[0.04]",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isWalletLocked ? (
                  <LockKeyhole className="h-4 w-4 text-rose-400 animate-pulse" />
                ) : (
                  <Wallet className="h-4 w-4 text-[#8B5CF6]" />
                )}
                <span className="font-medium text-sm text-[#F5F5F7]">
                  Số dư Ví
                </span>
              </div>
              {isWalletLocked && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500 text-white rounded">
                  ĐÃ KHÓA
                </span>
              )}
            </div>
            <div
              className={cn(
                "text-2xl font-semibold",
                isDebt ? "text-rose-400" : "text-emerald-400",
              )}
            >
              {isLoadingBalance ? "..." : formatCurrency(rawBalance)}
            </div>
            {isWalletLocked ? (
              <p className="text-rose-400 text-xs mt-2 font-medium">
                Ví bị khóa do sai số đối soát.
              </p>
            ) : isDebt ? (
              <p className="text-rose-400 text-xs mt-2 font-medium">
                Ví đang âm tiền.
              </p>
            ) : !canAfford && selectedSeats.length > 0 ? (
              <p className="text-rose-400 text-xs mt-2 font-medium">
                Số dư không đủ.
              </p>
            ) : null}
          </div>

          <Button
            className={cn(
              "w-full h-12 text-sm font-semibold",
              (isWalletLocked || isDebt) &&
                "bg-rose-600 hover:bg-rose-700 text-white",
            )}
            disabled={selectedSeats.length === 0 || !canAfford}
            isLoading={isBooking}
            onClick={handleConfirmBooking}
          >
            {isWalletLocked
              ? "Ví Đang Bị Khóa"
              : isDebt
                ? "Ví Đang Âm Tiền"
                : "Thanh toán bằng Ví"}
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
    <div className="flex-none w-64 rounded-2xl bg-[#15151B] border border-white/[0.08] p-5">
      <h4 className="text-center font-medium text-xs mb-4 text-[#92929F]">
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
                "h-12 rounded-xl border flex flex-col items-center justify-center text-xs font-semibold transition-all",
                seat.isBooked
                  ? "bg-[#0D0D10] border-white/[0.04] text-[#92929F]/40 cursor-not-allowed"
                  : isSelected
                    ? "bg-[#8B5CF6] border-[#8B5CF6] text-white shadow-[0_0_10px_rgba(139,92,246,0.3)] scale-105"
                    : "bg-[#0D0D10] border-white/[0.08] text-[#F5F5F7] hover:border-[#8B5CF6]/50",
              )}
            >
              <span>A{seat.seatNumber}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
