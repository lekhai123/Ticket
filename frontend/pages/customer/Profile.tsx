import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bookingApi } from "../../api/booking.api";
import { Button } from "../../components/ui/Button";
import { VipBadge } from "../../components/common/VipBadge";
import { formatCurrency, formatDate } from "../../utils/format";
import { useUser } from "../../hooks/useUser";
import { usePasskey } from "../../hooks/usePasskey";
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
  Fingerprint,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../utils/cn";

export default function Profile() {
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"info" | "tickets">("info");
  const { updateAvatar, isUploadingAvatar } = useUser();
  const { registerPasskey } = usePasskey();
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);

  // ✅ State cho phân trang vé
  const [ticketPage, setTicketPage] = useState(1);

  const { data: ticketsResponse, isLoading: isLoadingTickets } = useQuery({
    queryKey: ["my-tickets", user?.id, ticketPage],
    queryFn: () => bookingApi.getMyTickets(ticketPage, 5), // Lấy 5 vé 1 trang
    enabled: !!user?.id && activeTab === "tickets",
  });

  const cancelMutation = useMutation({
    mutationFn: (ticketId: number) => bookingApi.cancelBooking(ticketId),
    onSuccess: (res) => {
      alert(res.message || "Hủy vé thành công và đã hoàn tiền vào ví!");
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip"] });
    },
    onError: (err: any) => alert(err.message || "Hủy vé thất bại!"),
  });

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/auth/login", { replace: true });
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await updateAvatar(file);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRegisterPasskey = async () => {
    if (isRegisteringPasskey) return;
    setIsRegisteringPasskey(true);
    try {
      const res = await registerPasskey();
      if (res.success) alert("✅ " + res.message);
      else alert("❌ " + res.message);
    } catch (error) {
      alert("❌ Có lỗi xảy ra khi cài đặt Vân tay.");
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  if (!user) return null;

  const displayName = user?.fullName || "Người dùng";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.avatarUrl;

  const tickets = ticketsResponse?.data || [];
  const meta = ticketsResponse?.meta || { totalPages: 1 };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold tracking-tight mb-8 text-[#F5F5F7]">
        Trang cá nhân
      </h1>

      <div className="flex gap-6 mb-8 border-b border-white/[0.08]">
        <button
          onClick={() => setActiveTab("info")}
          className={cn(
            "pb-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-all",
            activeTab === "info"
              ? "border-[#8B5CF6] text-[#8B5CF6]"
              : "border-transparent text-[#92929F] hover:text-[#F5F5F7]",
          )}
        >
          <UserIcon className="h-4 w-4" /> Thông tin cá nhân
        </button>
        <button
          onClick={() => setActiveTab("tickets")}
          className={cn(
            "pb-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-all",
            activeTab === "tickets"
              ? "border-[#8B5CF6] text-[#8B5CF6]"
              : "border-transparent text-[#92929F] hover:text-[#F5F5F7]",
          )}
        >
          <Ticket className="h-4 w-4" /> Vé của tôi
        </button>
      </div>

      {activeTab === "info" && (
        <div className="rounded-3xl border border-white/[0.08] bg-[#15151B] p-8">
          <div className="flex items-center gap-6 mb-8 border-b border-white/[0.08] pb-8">
            <div className="relative group">
              <div className="h-24 w-24 rounded-full bg-[#0D0D10] flex items-center justify-center text-[#8B5CF6] text-3xl font-bold overflow-hidden border border-white/[0.08]">
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
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
              <h2 className="text-xl font-semibold text-[#F5F5F7] mb-2">
                {displayName}
              </h2>
              <VipBadge level={(user as any)?.vipLevel ?? 0} />
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#0D0D10] border border-white/[0.04] text-[#92929F]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#92929F]">
                  Email đăng nhập
                </p>
                <p className="text-sm font-medium text-[#F5F5F7]">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#0D0D10] border border-white/[0.04] text-[#92929F]">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#92929F]">Vai trò</p>
                <p className="text-sm font-medium text-[#F5F5F7]">
                  {user.role === "ADMIN" ? "Quản trị viên" : "Khách hàng"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Button
              variant="outline"
              onClick={handleLogout}
              className="text-rose-400 border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 w-full sm:w-auto"
            >
              <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
            </Button>

            {/* ✅ SỬA LỖI 2 ICON XOAY: Chỉ dùng isLoading của Button, xóa Loader2 thủ công */}
            <Button
              onClick={handleRegisterPasskey}
              disabled={isRegisteringPasskey}
              isLoading={isRegisteringPasskey}
              className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 w-full sm:w-auto disabled:opacity-50"
            >
              <Fingerprint className="mr-2 h-5 w-5" />
              {isRegisteringPasskey
                ? "Đang cài đặt..."
                : "Cài đặt Vân tay / FaceID"}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "tickets" && (
        <div className="space-y-4">
          {isLoadingTickets ? (
            <div className="text-center py-12 text-[#92929F]">
              Đang tải danh sách vé...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/[0.08] rounded-3xl bg-[#15151B]/50 text-[#92929F]">
              Bạn chưa đặt chuyến xe nào.
            </div>
          ) : (
            <>
              {tickets.map((ticket: any) => {
                const now = Date.now();
                const departureTime = new Date(
                  ticket.trip?.departureAt,
                ).getTime();
                const isMoreThanOneHourLeft =
                  departureTime - now > 60 * 60 * 1000;
                const canCancel =
                  ticket.status === "CONFIRMED" && isMoreThanOneHourLeft;

                return (
                  <div
                    key={ticket.id}
                    className={cn(
                      "border rounded-2xl p-6 bg-[#15151B] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors",
                      ticket.status === "REVOKED_BY_ADMIN"
                        ? "border-rose-500/20 bg-rose-500/[0.02]"
                        : "border-white/[0.08]",
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-[#F5F5F7]">
                        <MapPin className="h-4 w-4 text-[#8B5CF6]" />{" "}
                        {ticket.trip?.route || "Chuyến xe khách"}
                      </div>
                      <div className="text-sm text-[#92929F] flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />{" "}
                          {formatDate(ticket.trip?.departureAt)}
                        </span>
                        <span className="font-medium text-[#F5F5F7]">
                          Ghế: A{ticket.seatNumber}
                        </span>
                      </div>
                      <div className="text-xs font-medium">
                        Trạng thái:{" "}
                        <span
                          className={cn(
                            ticket.status === "CONFIRMED"
                              ? "text-emerald-400"
                              : ticket.status === "CANCELED"
                                ? "text-amber-400"
                                : ticket.status === "REVOKED_BY_ADMIN"
                                  ? "text-rose-400"
                                  : "text-[#92929F]",
                          )}
                        >
                          {ticket.status === "CONFIRMED"
                            ? "Đã thanh toán"
                            : ticket.status === "CANCELED"
                              ? "Đã hủy vé"
                              : ticket.status === "REVOKED_BY_ADMIN"
                                ? "Bị thu hồi"
                                : ticket.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                      <div className="text-lg font-semibold text-[#8B5CF6]">
                        {formatCurrency(ticket.trip?.price)}
                      </div>
                      {canCancel ? (
                        <Button
                          variant="outline"
                          className="text-rose-400 border-rose-500/20 hover:bg-rose-500/10 h-9 text-xs"
                          isLoading={cancelMutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Hủy vé ghế A${ticket.seatNumber}? Hoàn tiền 100%.`,
                              )
                            )
                              cancelMutation.mutate(ticket.id);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Hủy vé
                        </Button>
                      ) : ticket.status === "CONFIRMED" ? (
                        <span className="text-xs text-[#92929F] italic bg-[#0D0D10] px-3 py-1.5 rounded-lg border border-white/[0.04]">
                          Quá hạn hủy vé
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {/* ✅ PHÂN TRANG VÉ */}
              {(meta?.totalPages || 1) > 1 && (
                <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-white/[0.08]">
                  <button
                    onClick={() => {
                      setTicketPage((p) => p - 1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={ticketPage === 1}
                    className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-colors"
                  >
                    Trang trước
                  </button>
                  <span className="text-sm text-[#92929F]">
                    Trang{" "}
                    <strong className="text-[#F5F5F7]">{ticketPage}</strong> /{" "}
                    {meta.totalPages}
                  </span>
                  <button
                    onClick={() => {
                      setTicketPage((p) => p + 1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={ticketPage >= (meta?.totalPages || 1)}
                    className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-[#15151B] text-sm font-medium text-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.04] transition-colors"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
