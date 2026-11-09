import { Outlet, Link } from "react-router-dom";
import { BusFront, User, Wallet, AlertTriangle } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useWallet } from "../hooks/useWallet";
import { formatCurrency } from "../utils/format";
import SystemFooter from "../layouts/SystemFooter";

export default function CustomerLayout() {
  const { user, isAuthenticated } = useAuthStore();
  const { balance, isLoadingBalance } = useWallet(user?.id || 0);

  const displayBalance =
    typeof balance === "object"
      ? balance?.formatted
      : formatCurrency(Number(balance || 0));

  const avatarUrl = user?.avatarUrl;

  return (
    <div className="min-h-screen bg-[#0D0D10] text-[#F5F5F7] font-sans selection:bg-[#8B5CF6]/30 flex flex-col">
      {/* Floating Navbar */}
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/[0.08] bg-[#0D0D10]/80 px-6 backdrop-blur-md">
        <Link
          to="/"
          className="flex items-center gap-2 transition hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6] text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            <BusFront className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-[#F5F5F7]">
            NexusTicket
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* Nút Ví tiền */}
              <Link
                to="/customer/wallet"
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#15151B] px-4 py-1.5 text-sm font-medium transition hover:bg-white/[0.04]"
              >
                <Wallet className="h-4 w-4 text-[#8B5CF6]" />
                <span className="text-[#F5F5F7]">
                  {isLoadingBalance ? "..." : displayBalance}
                </span>
              </Link>

              {/* Nút Profile / Avatar */}
              <Link
                to="/customer/profile"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#15151B] transition hover:border-[#8B5CF6]/50 hover:scale-105"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user?.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-[#92929F]" />
                )}
              </Link>
            </>
          ) : (
            <Link
              to="/auth/login"
              className="rounded-xl bg-[#8B5CF6] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#7C3AED] shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            >
              Đăng nhập
            </Link>
          )}
        </nav>
      </header>

      {/* ✅ BANNER CẢNH BÁO NGHIÊN CỨU & SĐT LIÊN HỆ */}
      <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 text-amber-400 text-sm font-medium z-40 text-center">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Hệ thống đang trong quá trình nghiên cứu (Test). Nếu bạn lỡ phát
            sinh giao dịch chuyển tiền thật, vui lòng liên hệ ngay:
          </span>
        </div>
        <span className="font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">
          0363.489.863
        </span>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-300 flex-1">
        <Outlet />
      </main>
      <SystemFooter />
    </div>
  );
}
