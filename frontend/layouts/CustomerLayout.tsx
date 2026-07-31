import { Outlet } from "react-router-dom";
import { BusFront, User, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function CustomerLayout() {
  const { user, isAuthenticated } = useAuthStore();

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
              <Link
                to="/customer/wallet"
                className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium transition hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <Wallet className="h-4 w-4 text-indigo-500" />
                {new Intl.NumberFormat("vi-VN").format(user?.balance || 0)} ₫
              </Link>
              <Link
                to="/customer/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 transition hover:scale-105"
              >
                <User className="h-4 w-4" />
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
