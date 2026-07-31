import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketApi } from "../../api/ticket.api";
import { Button } from "../../components/ui/Button";
import { VipBadge } from "../../components/common/VipBadge";
import { formatCurrency, formatDate } from "../../utils/format";
import { useUser } from "../../hooks/useUser";
import {
  Mail,
  Shield,
  LogOut,
  Ticket,
  User as UserIcon,
  Calendar,
  MapPin,
  XCircle,
  Camera,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"info" | "tickets">("info");
  const { updateAvatar, isUploadingAvatar } = useUser();
  // Fetch danh sách vé
  const { data: ticketsResponse, isLoading: isLoadingTickets } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: () => ticketApi.getUserTickets(),
    enabled: !!user?.id && activeTab === "tickets",
  });

  // Mutation Hủy vé: Cập nhật invalidate cả "trips" để sơ đồ ghế nhả về Trống
  const cancelMutation = useMutation({
    mutationFn: (ticketId: number) => ticketApi.cancelTicket(ticketId),
    onSuccess: (res) => {
      alert(res.message || "Hủy vé thành công và đã hoàn tiền vào ví!");
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] }); // 🎯 Nhả ghế trên sơ đồ
      queryClient.invalidateQueries({ queryKey: ["trip"] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Hủy vé thất bại!");
    },
  });

  // 🎯 Đăng xuất chuẩn: Gọi API Logout (Xóa Cookie) -> Clear Zustand -> Chuyển hướng
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth/login", { replace: true });
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  // 🎯 Chuẩn bị sự kiện chọn file Avatar (Sẽ kết nối useUser hook)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await updateAvatar(file); // 🎯 Upload và cập nhật UI ngay lập tức
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) return null;

  const displayName =
    (user as any)?.fullName || (user as any)?.name || "Người dùng";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const avatarUrl = (user as any)?.avatarUrl || (user as any)?.avatar;
  const tickets = ticketsResponse?.data || [];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 tracking-tight">Trang cá nhân</h1>

      {/* Thanh chuyển Tab */}
      <div className="flex gap-4 mb-8 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("info")}
          className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "info"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <UserIcon className="h-4 w-4" /> Thông tin cá nhân
        </button>
        <button
          onClick={() => setActiveTab("tickets")}
          className={`pb-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === "tickets"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Ticket className="h-4 w-4" /> Vé của tôi
        </button>
      </div>

      {/* TAB 1: THÔNG TIN CÁ NHÂN */}
      {activeTab === "info" && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-6 mb-8 border-b border-zinc-100 pb-8 dark:border-zinc-800">
            {/* 🎯 AVATAR VỚI NÚT CHỌN ĐỔI ẢNH */}
            <div className="relative group">
              <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold dark:bg-indigo-900/30 dark:text-indigo-400 overflow-hidden border-2 border-indigo-200 dark:border-indigo-900">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  avatarInitial
                )}
              </div>

              {/* Overlay Nút Tải Ảnh */}
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Camera className="h-6 w-6" />
                )}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isUploadingAvatar}
                />
              </label>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                {displayName}
              </h2>
              <VipBadge level={(user as any)?.vipLevel ?? 0} />
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900">
                <Mail className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  Email đăng nhập
                </p>
                <p className="font-semibold">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900">
                <Shield className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500">Vai trò</p>
                <p className="font-semibold">
                  {user.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full sm:w-auto"
            >
              <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: VÉ CỦA TÔI */}
      {activeTab === "tickets" && (
        <div className="space-y-4">
          {isLoadingTickets ? (
            <div className="text-center py-12 text-zinc-500">
              Đang tải danh sách vé...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-3xl bg-zinc-50 text-zinc-500 dark:bg-zinc-900/50">
              Bạn chưa đặt chuyến xe nào.
            </div>
          ) : (
            tickets.map((ticket: any) => {
              const now = Date.now();
              const departureTime = new Date(
                ticket.trip?.departureAt,
              ).getTime();
              const ONE_HOUR_IN_MS = 60 * 60 * 1000;

              const isMoreThanOneHourLeft =
                departureTime - now > ONE_HOUR_IN_MS;
              const canCancel =
                ticket.status === "CONFIRMED" && isMoreThanOneHourLeft;

              return (
                <div
                  key={ticket.id}
                  className="border border-zinc-200 rounded-3xl p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-bold text-lg text-indigo-600">
                      <MapPin className="h-5 w-5" />{" "}
                      {ticket.trip?.route || "Chuyến xe khách"}
                    </div>
                    <div className="text-sm text-zinc-500 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />{" "}
                        {formatDate(ticket.trip?.departureAt)}
                      </span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        Ghế: A{ticket.seatNumber}
                      </span>
                    </div>
                    <div className="text-xs font-semibold">
                      Trạng thái:{" "}
                      <span
                        className={
                          ticket.status === "CONFIRMED"
                            ? "text-emerald-500 font-bold"
                            : ticket.status === "CANCELED"
                              ? "text-amber-500 font-bold"
                              : "text-red-500 font-bold"
                        }
                      >
                        {ticket.status === "CONFIRMED"
                          ? "Đã thanh toán"
                          : ticket.status === "CANCELED"
                            ? "Đã hủy vé (Hoàn tiền)"
                            : ticket.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                    <div className="text-xl font-bold text-indigo-600">
                      {formatCurrency(ticket.trip?.price)}
                    </div>

                    {canCancel ? (
                      <Button
                        variant="outline"
                        className="text-red-500 border-red-200 hover:bg-red-50 h-9 text-xs"
                        isLoading={cancelMutation.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `Bạn chắc chắn muốn hủy vé ghế A${ticket.seatNumber}? Hệ thống sẽ hoàn tiền 100% vào Ví.`,
                            )
                          ) {
                            cancelMutation.mutate(ticket.id);
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Hủy vé & Hoàn tiền
                      </Button>
                    ) : ticket.status === "CONFIRMED" ? (
                      <span className="text-xs text-zinc-400 font-medium italic bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        Quá hạn hủy vé (&lt; 1h trước khởi hành)
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
