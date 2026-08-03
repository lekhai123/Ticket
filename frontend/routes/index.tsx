import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

// Layouts
import AuthLayout from "../layouts/AuthLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import AdminLayout from "../layouts/AdminLayout";

// Auth Pages
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ResetPassword from "../pages/auth/ResetPassword";

// Customer Pages
import SearchTrip from "../pages/customer/SearchTrip";
import Booking from "../pages/customer/Booking";
import Wallet from "../pages/customer/Wallet";
import Profile from "../pages/customer/Profile";

// Admin Pages
import Dashboard from "../pages/admin/Dashboard";
import Users from "../pages/admin/User";
import MassGift from "../pages/admin/MassGift";
import AuditLog from "../pages/admin/AuditLog";
import Revoke from "../pages/admin/Revoke";
import Health from "../pages/admin/Health";

export const router = createBrowserRouter([
  // 1. AUTH ROUTES
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ResetPassword /> },
      { path: "", element: <Navigate to="/auth/login" replace /> },
    ],
  },

  // 2. CUSTOMER ROUTES
  {
    path: "/",
    element: <CustomerLayout />,
    children: [
      { index: true, element: <SearchTrip /> },
      { path: "booking/:id", element: <Booking /> },
      { path: "customer/wallet", element: <Wallet /> },
      { path: "customer/profile", element: <Profile /> },
    ],
  },

  // 3. ADMIN ROUTES
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      // Mặc định truy cập /admin sẽ redirect về /admin/dashboard
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "users", element: <Users /> },
      { path: "mass-gift", element: <MassGift /> },
      // 🎯 Đã sửa từ "audit-log" -> "audit-logs" khớp với AdminLayout
      { path: "audit-logs", element: <AuditLog /> },
      { path: "revoke", element: <Revoke /> },
      { path: "health", element: <Health /> },
    ],
  },

  // 4. ERROR ROUTES
  {
    path: "*",
    element: (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <h1 className="text-6xl font-bold text-indigo-500">404</h1>
        <p className="mt-4 text-lg text-zinc-400">
          Trang bạn tìm kiếm không tồn tại.
        </p>
        <a
          href="/"
          className="mt-6 rounded-xl bg-zinc-800 px-6 py-2.5 text-sm font-medium hover:bg-zinc-700"
        >
          Về trang chủ
        </a>
      </div>
    ),
  },
]);
