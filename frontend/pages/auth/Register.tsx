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
      setError(err.message || "Gửi OTP thất bại!");
    }
  };

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
      setError(err.message || "Đăng ký thất bại!");
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
        Tạo tài khoản mới
      </h1>
      <p className="mt-2 mb-8 text-sm text-[#92929F]">
        Bắt đầu hành trình cùng NexusTicket.
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

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">
            Họ và tên
          </label>
          <input
            type="text"
            name="name"
            placeholder="Nguyễn Văn A"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/[0.08] bg-[#15151B] px-3 py-2.5 text-[#F5F5F7] placeholder:text-[#92929F]/50 outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">Email</label>
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
          <label className="text-sm font-medium text-[#F5F5F7]">Mật khẩu</label>
          <input
            type="password"
            name="password"
            placeholder="••••••••"
            required
            value={formData.password}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/[0.08] bg-[#15151B] px-3 py-2.5 text-[#F5F5F7] placeholder:text-[#92929F]/50 outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">
            Xác nhận mật khẩu
          </label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/[0.08] bg-[#15151B] px-3 py-2.5 text-[#F5F5F7] placeholder:text-[#92929F]/50 outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
          />
        </div>

        <button
          type="submit"
          disabled={isRegistering}
          className="mt-2 w-full rounded-xl bg-[#8B5CF6] py-3 font-medium text-white transition hover:bg-[#7C3AED] disabled:opacity-50 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
        >
          {isRegistering ? "Đang xử lý..." : "Đăng Ký Hoàn Tất"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#92929F]">
        Đã có tài khoản?{" "}
        <Link
          to="/auth/login"
          className="font-medium text-[#8B5CF6] hover:text-[#7C3AED] transition"
        >
          Đăng nhập ngay
        </Link>
      </p>
    </div>
  );
}
