import axios from "axios";
import { useAuthStore } from "../store/authStore";

// 1. Tự động nhận diện Base URL linh hoạt:
// - Nếu có biến VITE_API_URL -> dùng biến đó.
// - Nếu ở Production (Deploy Vercel chung domain) -> dùng relative path "/api" (Tránh 100% lỗi CORS).
// - Nếu ở Local Development -> dùng "http://localhost:3000/api".
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:3000/api");

const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Instance riêng cho Refresh Token để tránh dính Interceptor đệ quy
const refreshAxios = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Request Interceptor: Gắn X-Request-ID và Bearer Token
axiosClient.interceptors.request.use((config) => {
  // Sinh UUID cho Distributed Tracing
  config.headers["X-Request-ID"] ??= crypto.randomUUID();

  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Response Interceptor: Tự động Refresh Token khi 401
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Kiểm tra nếu lỗi 401 và chưa từng thử retry
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh-token") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      originalRequest._retry = true;

      try {
        // Dùng refreshAxios độc lập để lấy Token mới
        const refreshRes = await refreshAxios.post("/auth/refresh-token");

        const accessToken =
          refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;

        if (accessToken) {
          useAuthStore.getState().setAccessToken(accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosClient(originalRequest);
        }
      } catch (refreshErr) {
        // Refresh token hết hạn hoặc không hợp lệ -> Logout
        useAuthStore.getState().logout();
        if (window.location.pathname !== "/auth/login") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error.response?.data ?? error);
  },
);

export default axiosClient;
