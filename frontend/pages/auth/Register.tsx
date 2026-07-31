import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { register, isRegistering, requestOtp, isSendingOtp, otpCooldown } =
    useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 📧 Hàm yêu cầu gửi OTP đăng ký
  const handleSendOtp = async () => {
    setError("");
    setSuccessMsg("");

    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError("Vui lòng nhập Email hợp lệ trước khi lấy mã OTP!");
      return;
    }

    try {
      await requestOtp({ email: formData.email, type: "REGISTER" });
      setSuccessMsg("Mã OTP đã được gửi về Email của bạn!");
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Gửi OTP thất bại!",
      );
    }
  };

  // 📝 Hàm Hoàn tất Đăng ký
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp!");
      return;
    }

    if (!formData.otp || formData.otp.length !== 6) {
      setError("Vui lòng nhập đúng 6 chữ số mã OTP!");
      return;
    }

    try {
      await register({
        fullName: formData.name,
        email: formData.email,
        password: formData.password,
        otp: formData.otp,
      });

      alert("Đăng ký tài khoản thành công! Hãy đăng nhập ngay.");
      navigate("/auth/login");
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Đăng ký thất bại!",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md"
      >
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-indigo-400">NexusTicket.</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Tạo tài khoản mới kèm OTP
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            {successMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Họ và tên
            </label>
            <input
              type="text"
              name="name"
              placeholder="Nguyễn Văn A"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                name="email"
                placeholder="example@gmail.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                required
              />
              <button
                type="button"
                disabled={otpCooldown > 0 || isSendingOtp}
                onClick={handleSendOtp}
                className="whitespace-nowrap rounded-xl bg-indigo-600/80 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 min-w-[100px]"
              >
                {isSendingOtp
                  ? "Đang gửi..."
                  : otpCooldown > 0
                    ? `${otpCooldown}s`
                    : "Gửi OTP"}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Mã OTP (6 chữ số)
            </label>
            <input
              type="text"
              name="otp"
              placeholder="123456"
              maxLength={6}
              value={formData.otp}
              onChange={handleChange}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Mật khẩu
            </label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Xác nhận mật khẩu
            </label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isRegistering}
          className="mt-6 w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isRegistering ? "Đang xử lý..." : "Đăng Ký Hoàn Tất"}
        </button>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Đã có tài khoản?{" "}
          <Link
            to="/auth/login"
            className="font-medium text-indigo-400 hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </p>
      </form>
    </div>
  );
}
