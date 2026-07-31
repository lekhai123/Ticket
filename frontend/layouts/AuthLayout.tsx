import { Outlet, Navigate } from "react-router-dom";
import { BusFront, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Nếu đã login, tự động đá về Dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Cột trái: Nơi chứa Form (Outlet) */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:w-[500px]">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">
              <BusFront className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              NexusTicket.
            </span>
          </div>
          {/* Nơi render Login, Register */}
          <Outlet />
        </div>
      </div>

      {/* Cột phải: Hình ảnh & Graphic (Glassmorphism) */}
      <div className="relative hidden w-full flex-1 lg:block overflow-hidden bg-zinc-50 dark:bg-zinc-900">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl shadow-2xl">
            <ShieldCheck className="h-12 w-12 text-zinc-900 dark:text-white mb-6" />
            <h2 className="text-3xl font-bold mb-4">Enterprise Grade.</h2>
            <p className="text-zinc-600 dark:text-zinc-300">
              Hệ thống lõi bảo mật cao, tốc độ phản hồi tính bằng mili-giây. Sẵn
              sàng xử lý hàng ngàn giao dịch vé xe cùng lúc.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
