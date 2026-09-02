// FILE: pages/customer/Booking.tsx
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

  // State mở Modal khi Ví bị Khóa / Âm tiền
  const [lockedWalletModal, setLockedWalletModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({ isOpen: false, message: "" });

  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  // 1. Fetch chuyến xe thực tế theo ID
  const { data: trip, isLoading: isTripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => {
      if (!id) return null;
      return await tripApi.getById(id);
    },
    enabled: !!id,
  });

  // 2. Fetch số dư ví & trạng thái ví
  const { balance, isLoadingBalance } = useWallet(user?.id || 0);
  const { bookTicket, isBooking } = useTicket();

  // Bóc tách tên tuyến xe
  const [origin, destination] = trip?.route
    ? trip.route.split(" - ")
    : [(trip as any)?.origin || "--", (trip as any)?.destination || "--"];

  // 3. Xử lý logic ghế ngồi động theo dữ liệu Backend
  const totalSeats = Number(trip?.totalSeats) || 30;

  const bookedSeatNumbers: number[] = useMemo(() => {
    if (trip?.bookedSeatNumbers && Array.isArray(trip.bookedSeatNumbers)) {
      return trip.bookedSeatNumbers.map(Number);
    }
    // Fallback nếu backend trả về mảng tickets nguyên thủy
    return (
      trip?.tickets
        ?.filter((t: any) =>
          ["HELD", "PENDING", "CONFIRMED"].includes(t.status),
        )
        .map((t: any) => Number(t.seatNumber)) || []
    );
  }, [trip]);

  // Chia 2 tầng động theo tổng số ghế
  const halfSeats = Math.ceil(totalSeats / 2);

  const seatsFloor1 = useMemo(() => {
    return Array.from({ length: halfSeats }, (_, i) => {
      const seatNum = i + 1;
      return {
        seatNumber: seatNum,
        isBooked: bookedSeatNumbers.includes(seatNum),
      };
    });
  }, [halfSeats, bookedSeatNumbers]);

  const seatsFloor2 = useMemo(() => {
    return Array.from({ length: totalSeats - halfSeats }, (_, i) => {
      const seatNum = halfSeats + i + 1;
      return {
        seatNumber: seatNum,
        isBooked: bookedSeatNumbers.includes(seatNum),
      };
    });
  }, [totalSeats, halfSeats, bookedSeatNumbers]);

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

  // Kiểm tra điều kiện ví: Âm tiền hoặc Bị Khóa
  const isWalletLocked = Boolean((balance as any)?.isLocked);
  const isDebt = rawBalance < 0;
  const canAfford = rawBalance >= totalPrice && !isWalletLocked && !isDebt;

  // 4. Xử lý đặt vé
  const handleConfirmBooking = async () => {
    if (!canAfford || selectedSeats.length === 0 || !id) return;

    try {
      await bookTicket({
        tripId: Number(id),
        seatNumbers: selectedSeats,
        paymentMethod: "WALLET",
      } as any);

      // Làm tươi lại cache ghế và số dư ví
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
            "Ví của bạn đang bị khóa do dính chênh lệch tài chính/ghi nợ âm. Vui lòng nạp tiền để mở khóa!",
        });
        return;
      }

      alert(errResponse?.message || err.message || "Thanh toán thất bại.");
    }
  };

  if (isTripLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Cột trái: Sơ đồ ghế co giãn động */}
      <div className="col-span-1 lg:col-span-2 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bus className="h-6 w-6 text-indigo-500" /> Sơ đồ chọn ghế (Xe{" "}
            {totalSeats} chỗ)
          </h2>
          <span
            className={cn(
              "text-xs font-semibold px-3 py-1 rounded-full border",
              availableSeatsCount === 0
                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
            )}
          >
            Còn trống: {availableSeatsCount} / {totalSeats} chỗ
          </span>
        </div>

        <div className="flex gap-8 overflow-x-auto pb-4 custom-scrollbar">
          <SeatFloor
            title={`Tầng Dưới (Ghế 1 - ${halfSeats})`}
            seats={seatsFloor1}
            selected={selectedSeats}
            onSelect={handleToggleSeat}
          />
          <SeatFloor
            title={`Tầng Trên (Ghế ${halfSeats + 1} - ${totalSeats})`}
            seats={seatsFloor2}
            selected={selectedSeats}
            onSelect={handleToggleSeat}
          />
        </div>

        {/* Chú thích màu sắc */}
        <div className="flex items-center gap-6 pt-2 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950" />
            <span>Ghế trống</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-indigo-600 border border-indigo-500" />
            <span>Đang chọn</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800" />
            <span>Đã đặt</span>
          </div>
        </div>
      </div>

      {/* Cột phải: Box Thanh Toán & Ví */}
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
              <span>Đơn giá:</span>
              <span className="font-medium text-zinc-900 dark:text-white">
                {formatCurrency(unitPrice)} / vé
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

          {/* Box Cảnh báo số dư ví & trạng thái ví */}
          <div
            className={cn(
              "rounded-xl p-4 mb-6 transition-all",
              isWalletLocked || isDebt
                ? "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
                : "bg-zinc-100 dark:bg-zinc-900",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isWalletLocked ? (
                  <LockKeyhole className="h-5 w-5 text-red-600 animate-pulse" />
                ) : (
                  <Wallet className="h-5 w-5 text-indigo-500" />
                )}
                <span className="font-medium text-sm">Số dư Ví cá nhân</span>
              </div>
              {isWalletLocked && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded-full">
                  ĐÃ KHÓA VÍ
                </span>
              )}
            </div>

            <div
              className={cn(
                "text-2xl font-bold",
                isDebt ? "text-red-600 dark:text-red-400" : "text-emerald-500",
              )}
            >
              {isLoadingBalance ? "..." : formatCurrency(rawBalance)}
            </div>

            {isWalletLocked ? (
              <p className="text-red-600 text-xs mt-2 flex items-start gap-1 font-medium">
                <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> Ví bị khóa
                do dính sai số đối soát. Vui lòng nạp tiền thanh toán khoản nợ
                hoặc liên hệ Admin!
              </p>
            ) : isDebt ? (
              <p className="text-red-600 text-xs mt-2 flex items-start gap-1 font-medium">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> Ví
                của bạn đang âm tiền. Vui lòng nạp thêm để trả nợ!
              </p>
            ) : !canAfford && selectedSeats.length > 0 ? (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1 font-medium">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> Số dư ví
                không đủ. Vui lòng nạp thêm tiền!
              </p>
            ) : null}
          </div>

          <Button
            className={cn(
              "w-full h-12 text-base font-semibold",
              (isWalletLocked || isDebt) &&
                "bg-red-600 hover:bg-red-700 text-white",
            )}
            disabled={selectedSeats.length === 0 || !canAfford}
            isLoading={isBooking}
            onClick={handleConfirmBooking}
          >
            {isWalletLocked
              ? "Ví Đang Bị Khóa"
              : isDebt
                ? "Ví Đang Âm Tiền"
                : "Thanh toán bằng Ví ngay"}
          </Button>
        </div>
      </div>

      {/* Modal thông báo ví bị khóa / Nợ tiền */}
      {lockedWalletModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-500/30 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-full flex items-center justify-center">
              <LockKeyhole className="w-6 h-6 animate-bounce" />
            </div>

            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Tài Khoản Tạm Thời Bị Hạn Chế
            </h3>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {lockedWalletModal.message}
            </p>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setLockedWalletModal({ isOpen: false, message: "" })
                }
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => navigate("/customer/wallet/topup")}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md"
              >
                Nạp Tiền Ngay ➔
              </button>
            </div>
          </div>
        </div>
      )}
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
                  ? "bg-zinc-200 border-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-600"
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
