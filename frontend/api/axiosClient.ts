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

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh-token") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      originalRequest._retry = true;

      try {
        const refreshRes = await refreshAxios.post("/auth/refresh-token");
        const accessToken =
          refreshRes.data?.data?.accessToken || refreshRes.data?.accessToken;

        if (accessToken) {
          useAuthStore.getState().setAccessToken(accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosClient(originalRequest);
        }
      } catch (refreshErr) {
        useAuthStore.getState().logout();
        if (window.location.pathname !== "/auth/login") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(refreshErr);
      }
    }

    // Giữ lại HTTP Status Code để FE dễ bắt lỗi (VD: 403, 404)
    const errorData = error.response?.data || {};
    const errorMessage =
      errorData.message || error.message || "Đã có lỗi xảy ra";
    return Promise.reject({
      ...errorData,
      status: error.response?.status,
      message: errorMessage,
    });
  },
);

export default axiosClient;
