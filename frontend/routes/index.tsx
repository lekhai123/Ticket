import React, { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

// Layouts (Giữ nguyên import tĩnh vì đây là khung viền, load ngay lập tức)
import AuthLayout from "../layouts/AuthLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import AdminLayout from "../layouts/AdminLayout";
import TicketManagement from "../pages/admin/TicketManagement";

// Component hiển thị khi đang tải (Loading)
const LoadingFallback = () => (
  <div className="h-[60vh] w-full flex items-center justify-center bg-transparent">
    <div className="animate-spin h-8 w-8 border-4 border-[#8B5CF6] border-t-transparent rounded-full" />
  </div>
);

// CHUYỂN SANG LAZY IMPORTS (Chỉ tải khi user click vào)
// Auth Pages
const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const ResetPassword = lazy(() => import("../pages/auth/ResetPassword"));

// Customer Pages
const SearchTrip = lazy(() => import("../pages/customer/SearchTrip"));
const Booking = lazy(() => import("../pages/customer/Booking"));
const Wallet = lazy(() => import("../pages/customer/Wallet"));
const Profile = lazy(() => import("../pages/customer/Profile"));

// Admin Pages
const Dashboard = lazy(() => import("../pages/admin/Dashboard"));
const Users = lazy(() => import("../pages/admin/User"));
const MassGift = lazy(() => import("../pages/admin/MassGift"));
const AuditLog = lazy(() => import("../pages/admin/AuditLog"));
const Revoke = lazy(() => import("../pages/admin/Revoke"));
const Health = lazy(() => import("../pages/admin/Health"));
const TripManagement = lazy(() => import("../pages/admin/TripManagement"));

// Lưu ý: File FinancialReconciliation của bạn đang dùng Named Export (export const)
// nên cần nội suy lại thành Default Export để React.lazy hiểu.
const FinancialReconciliation = lazy(() =>
  import("../pages/admin/FinancialReconciliation").then((module) => ({
    default: module.FinancialReconciliation,
  })),
);

// HÀM BỌC SUSPENSE: Giúp Sidebar/Navbar không bị ẩn khi trang con đang tải
const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  // 1. AUTH ROUTES
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: withSuspense(Login) },
      { path: "register", element: withSuspense(Register) },
      { path: "forgot-password", element: withSuspense(ResetPassword) },
      { path: "", element: <Navigate to="/auth/login" replace /> },
    ],
  },

  // 2. CUSTOMER ROUTES
  {
    path: "/",
    element: <CustomerLayout />,
    children: [
      { index: true, element: withSuspense(SearchTrip) },
      { path: "booking/:id", element: withSuspense(Booking) },
      { path: "customer/wallet", element: withSuspense(Wallet) },
      { path: "customer/profile", element: withSuspense(Profile) },
    ],
  },

  // 3. ADMIN ROUTES
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: "dashboard", element: withSuspense(Dashboard) },
      { path: "users", element: withSuspense(Users) },
      { path: "mass-gift", element: withSuspense(MassGift) },
      { path: "audit-logs", element: withSuspense(AuditLog) },
      { path: "revoke", element: withSuspense(Revoke) },
      { path: "health", element: withSuspense(Health) },
      {
        path: "reconciliation",
        element: withSuspense(FinancialReconciliation),
      },
      { path: "tickets", element: withSuspense(TicketManagement) },
      { path: "trips", element: withSuspense(TripManagement) },
    ],
  },

  // 4. ERROR ROUTES
  {
    path: "*",
    element: (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0D0D10] text-white">
        <h1 className="text-6xl font-bold text-[#8B5CF6]">404</h1>
        <p className="mt-4 text-lg text-[#92929F]">
          Trang bạn tìm kiếm không tồn tại.
        </p>
        <a
          href="/"
          className="mt-6 rounded-xl bg-white/[0.08] px-6 py-2.5 text-sm font-medium hover:bg-white/[0.15] transition-colors"
        >
          Về trang chủ
        </a>
      </div>
    ),
  },
]);
