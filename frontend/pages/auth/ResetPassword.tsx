import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ResetPassword() {
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    newPassword: "",
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const {
    resetPassword,
    isResettingPassword,
    requestOtp,
    isSendingOtp,
    otpCooldown,
  } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOtp = async () => {
    setError("");
    setSuccessMsg("");

    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      setError("Vui lòng nhập Email hợp lệ trước khi lấy mã OTP!");
      return;
    }

    try {
      await requestOtp({ email: formData.email, type: "FORGOT_PASSWORD" });
      setSuccessMsg("Mã OTP khôi phục đã được gửi về Email!");
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Gửi OTP thất bại!",
      );
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.otp || formData.otp.length !== 6) {
      setError("Mã OTP phải gồm đúng 6 chữ số!");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Mật khẩu mới phải từ 6 ký tự trở lên!");
      return;
    }

    try {
      await resetPassword({
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword,
      });

      alert("Đặt lại mật khẩu thành công! Vui lòng đăng nhập.");
      navigate("/auth/login");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Đặt lại mật khẩu thất bại!",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <form
        onSubmit={handleResetPassword}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md"
      >
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-indigo-400">
            Khôi Phục Mật Khẩu
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Nhập Email & OTP để đổi mật khẩu mới
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
              Email tài khoản
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
              Mật khẩu mới
            </label>
            <input
              type="password"
              name="newPassword"
              placeholder="••••••••"
              value={formData.newPassword}
              onChange={handleChange}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isResettingPassword}
          className="mt-6 w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isResettingPassword ? "Đang xử lý..." : "Xác Nhận Đặt Lại Mật Khẩu"}
        </button>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Nhớ ra mật khẩu?{" "}
          <Link
            to="/auth/login"
            className="font-medium text-indigo-400 hover:underline"
          >
            Quay lại Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
