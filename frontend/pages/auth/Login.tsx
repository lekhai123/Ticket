import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Email không đúng định dạng"),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự"),
  rememberMe: z.boolean(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });

      const from = (location.state as any)?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
        return;
      }
      navigate(result.user.role === "ADMIN" ? "/admin" : "/", {
        replace: true,
      });
    } catch (err: any) {
      setError("root", { message: err?.message ?? "Sai email hoặc mật khẩu." });
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
        Đăng nhập
      </h1>
      <p className="mt-2 mb-8 text-sm text-[#92929F]">
        Chào mừng trở lại với NexusTicket.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">Email</label>
          <Input
            {...register("email")}
            placeholder="admin@nexusticket.com"
            error={errors.email?.message}
            className="bg-[#15151B] border-white/[0.08] text-[#F5F5F7] placeholder:text-[#92929F]/50 focus-visible:ring-[#8B5CF6]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[#F5F5F7]">
              Mật khẩu
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-xs font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <Input
            type="password"
            {...register("password")}
            placeholder="••••••••"
            error={errors.password?.message}
            className="bg-[#15151B] border-white/[0.08] text-[#F5F5F7] placeholder:text-[#92929F]/50 focus-visible:ring-[#8B5CF6]"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            type="checkbox"
            {...register("rememberMe")}
            className="h-4 w-4 rounded border-white/[0.08] bg-[#15151B] text-[#8B5CF6] focus:ring-[#8B5CF6]"
          />
          <label
            htmlFor="rememberMe"
            className="cursor-pointer text-sm text-[#92929F]"
          >
            Ghi nhớ đăng nhập
          </label>
        </div>

        {errors.root && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-center text-sm text-rose-400">
            {errors.root.message}
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
          isLoading={isLoggingIn}
        >
          Đăng nhập
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[#92929F]">
        Chưa có tài khoản?{" "}
        <Link
          to="/auth/register"
          className="font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition"
        >
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}
