import { Outlet } from "react-router-dom";
import { BusFront, User, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useWallet } from "../hooks/useWallet";
import { formatCurrency } from "../utils/format";

export default function CustomerLayout() {
  const { user, isAuthenticated } = useAuthStore();

  // 1. Fetch số dư thực tế từ hook useWallet
  const { balance, isLoadingBalance } = useWallet(user?.id || 0);

  // 2. Format số tiền hiển thị
  const displayBalance =
    typeof balance === "object"
      ? balance?.formatted
      : formatCurrency(Number(balance || 0));

  // 3. Lấy link Avatar (hỗ trợ cả 2 tên field avatarUrl hoặc avatar)
  const avatarUrl = user?.avatarUrl || (user as any)?.avatar;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Floating Navbar */}
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-zinc-200/50 bg-white/70 px-6 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/70">
        <Link to="/" className="flex items-center gap-2">
          <BusFront className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <span className="font-bold text-lg tracking-tight">NexusTicket</span>
        </Link>

        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {/* Nút Ví tiền */}
              <Link
                to="/customer/wallet"
                className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <Wallet className="h-4 w-4 text-indigo-500" />
                <span>{isLoadingBalance ? "..." : displayBalance}</span>
              </Link>

              {/* Nút Profile / Avatar */}
              <Link
                to="/customer/profile"
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 transition hover:scale-105 border border-zinc-300 dark:border-zinc-700"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user?.name || "Avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                )}
              </Link>
            </>
          ) : (
            <Link
              to="/auth/login"
              className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
            >
              Đăng nhập
            </Link>
          )}
        </nav>
      </header>

      {/* Nơi render các trang Customer */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
