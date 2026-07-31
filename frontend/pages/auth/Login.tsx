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
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
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
      setError("root", {
        message: err?.message ?? "Sai email hoặc mật khẩu.",
      });
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-bold tracking-tight">
        Đăng nhập vào hệ thống
      </h1>

      <p className="mt-2 mb-8 text-sm text-zinc-500">
        Hệ thống lõi - Vui lòng nhập thông tin để truy cập.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email</label>

          <Input
            {...register("email")}
            placeholder="admin@nexusticket.com"
            error={errors.email?.message}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Mật khẩu</label>

            <Link
              to="/auth/forgot-password"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              Quên mật khẩu?
            </Link>
          </div>

          <Input
            type="password"
            {...register("password")}
            placeholder="••••••••"
            error={errors.password?.message}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            type="checkbox"
            {...register("rememberMe")}
            className="h-4 w-4 rounded border-zinc-300"
          />

          <label htmlFor="rememberMe" className="cursor-pointer text-sm">
            Ghi nhớ đăng nhập
          </label>
        </div>

        {errors.root && (
          <div className="rounded-lg bg-red-600 p-3 text-center text-white">
            {errors.root.message}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={isLoggingIn}>
          Đăng nhập
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Chưa có tài khoản?{" "}
        <Link to="/auth/register" className="font-semibold text-indigo-600">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}
