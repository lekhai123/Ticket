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
      setError(err.message || "Gửi OTP thất bại!");
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
      setError(err.message || "Đặt lại mật khẩu thất bại!");
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
        Khôi phục mật khẩu
      </h1>
      <p className="mt-2 mb-8 text-sm text-[#92929F]">
        Nhập Email & OTP để tạo mật khẩu mới.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-400">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">
            Email tài khoản
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              name="email"
              placeholder="example@gmail.com"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-white/[0.08] bg-[#15151B] px-3 py-2.5 text-[#F5F5F7] placeholder:text-[#92929F]/50 outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
            />
            <button
              type="button"
              disabled={otpCooldown > 0 || isSendingOtp}
              onClick={handleSendOtp}
              className="whitespace-nowrap rounded-xl bg-[#8B5CF6]/20 px-3 text-xs font-medium text-[#8B5CF6] border border-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 disabled:opacity-50 min-w-[100px] transition"
            >
              {isSendingOtp
                ? "Đang gửi..."
                : otpCooldown > 0
                  ? `${otpCooldown}s`
                  : "Gửi OTP"}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">
            Mã OTP (6 chữ số)
          </label>
          <input
            type="text"
            name="otp"
            placeholder="123456"
            maxLength={6}
            required
            value={formData.otp}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/[0.08] bg-[#15151B] px-3 py-2.5 text-[#F5F5F7] placeholder:text-[#92929F]/50 outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">
            Mật khẩu mới
          </label>
          <input
            type="password"
            name="newPassword"
            placeholder="••••••••"
            required
            value={formData.newPassword}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/[0.08] bg-[#15151B] px-3 py-2.5 text-[#F5F5F7] placeholder:text-[#92929F]/50 outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
          />
        </div>

        <button
          type="submit"
          disabled={isResettingPassword}
          className="mt-2 w-full rounded-xl bg-[#8B5CF6] py-3 font-medium text-white transition hover:bg-[#7C3AED] disabled:opacity-50 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
        >
          {isResettingPassword ? "Đang xử lý..." : "Xác Nhận Đặt Lại Mật Khẩu"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#92929F]">
        Nhớ ra mật khẩu?{" "}
        <Link
          to="/auth/login"
          className="font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition"
        >
          Quay lại Đăng nhập
        </Link>
      </p>
    </div>
  );
}
