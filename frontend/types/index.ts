// ==========================================
// 1. CORE & COMMON API TYPES
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
}

export type Role = "ADMIN" | "CUSTOMER";
export type VipLevel = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
export type UserStatus = "ACTIVE" | "BANNED" | "LOCKED";

// ==========================================
// 2. USER & AUTHENTICATION TYPES
// ==========================================

export interface User {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  vipLevel: VipLevel;
  balance: number;
  totalSpent: number;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface AuthResponseData {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export interface UserFilterParams {
  search?: string;
  role?: Role;
  vipLevel?: VipLevel;
  status?: UserStatus;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ==========================================
// 3. TRIP & BOOKING TYPES (CHUẨN HÓA DUY NHẤT)
// ==========================================

export type TripStatus = "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELED";

export interface Seat {
  id: string;
  code: string;
  floor: "A" | "B";
  isBooked: boolean;
  price?: number;
}

export interface Trip {
  id: number;
  route: string;
  description?: string | null;
  departureAt: string;
  price: number;
  totalSeats: number;
  availableSeats: number;
  bookedSeatNumbers: number[]; // Mảng các ghế đã có người giữ/mua
  status?: TripStatus;
  tickets?: Array<{
    seatNumber: number;
    status: string;
  }>;
  similarity?: number;
  origin?: string;
  destination?: string;
  departureTime?: string;
  arrivalTime?: string;
  busType?: string;
  seats?: Seat[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TripSearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  minPrice?: number;
  maxPrice?: number;
  timeSlot?: "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
  page?: number;
  limit?: number;
}

export interface SemanticSearchPayload {
  prompt: string;
}

export interface CreateTripPayload {
  route: string;
  description?: string;
  departureAt: string;
  price: number;
  totalSeats: number;
  busType?: string;
}

export interface UpdateTripPayload extends Partial<CreateTripPayload> {
  status?: TripStatus;
}

// ==========================================
// 4. TICKET TYPES
// ==========================================

export interface Ticket {
  id: number;
  userId: number;
  tripId: number;
  seatNumber: number;
  status:
    | "HELD"
    | "PENDING"
    | "CONFIRMED"
    | "EXPIRED"
    | "USED"
    | "CANCELED"
    | "REVOKED_BY_ADMIN";
  createdAt?: string;
}

export interface BookTicketPayload {
  tripId: string | number;
  seatIds?: string[];
  seatNumbers?: number[];
  paymentMethod?: "WALLET" | "CASH" | "VNPAY";
  voucherCode?: string;
}

// ==========================================
// 5. WALLET & TRANSACTION TYPES
// ==========================================

export type TransactionAction =
  | "TOP_UP"
  | "WITHDRAW"
  | "PAYMENT"
  | "REFUND"
  | "SYSTEM_GIFT_BALANCE"
  | "MASS_GIFT"
  | "REVOKE"
  | "ADJUSTMENT";

export interface Wallet {
  id: number;
  userId: number;
  balance: number;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  walletId: number;
  userId: number;
  action: TransactionAction;
  amount: number;
  balanceAfter: number;
  description?: string;
  requestId?: string;
  batchId?: string;
  createdAt: string;
}

export interface TopUpPayload {
  amount: number;
  action?: TransactionAction;
  batchId?: string;
  description?: string;
}

export interface AdjustWalletPayload {
  userId: number;
  amount: number;
  reason: string;
  batchId?: string;
}

// ==========================================
// 6. VOUCHER TYPES
// ==========================================

export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface Voucher {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface CreateVoucherPayload {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit: number;
  startDate: string;
  endDate: string;
}

// ==========================================
// 7. AUDIT LOG & REVOKE TYPES
// ==========================================

export interface AuditLog {
  id: string;
  requestId: string;
  batchId?: string;
  userId: number;
  action: string;
  resource: string;
  resourceId: string;
  oldData: any;
  newData: any;
  ipAddress: string;
  userAgent?: string;
  isRevoked: boolean;
  createdAt: string;
}

export interface AuditLogFilterParams {
  search?: string;
  requestId?: string;
  batchId?: string;
  userId?: number;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface RevokeBatchPayload {
  batchId: string;
  adminUserId: number;
  reason?: string;
}

export interface RevokeBatchResponseData {
  batchId: string;
  revokedCount: number;
  totalAmountRevoked: number;
}

// ==========================================
// 8. MASS GIFT TYPES
// ==========================================

export type TargetType = "ALL" | "GROUP" | "SINGLE";
export type GiftType = "MONEY" | "VOUCHER";

export interface MassGiftPayload {
  targetType: TargetType;
  targetId?: string;
  giftType: GiftType;
  amount: number;
  voucherCode?: string;
  batchId: string;
  reason: string;
}

export interface MassGiftResponseData {
  batchId: string;
  successCount: number;
  failedCount: number;
  totalDistributed: number;
}

// ==========================================
// 9. RECONCILIATION & MONITORING TYPES
// ==========================================

export interface DiscrepancyReport {
  walletId: number;
  userId: number;
  dbBalance: number;
  calculatedBalance: number;
  difference: number;
  isMatch: boolean;
}

export interface ReconciliationSummary {
  totalChecked: number;
  discrepanciesCount: number;
  status: "HEALTHY" | "DISCREPANCY_DETECTED";
  reports: DiscrepancyReport[];
}

export interface ServiceHealthItem {
  name: string;
  status: "operational" | "degraded" | "outage";
  latency: number;
  message?: string;
}

export interface SystemHealthData {
  services: ServiceHealthItem[];
  timestamp: string;
}

export interface AdminDashboardStats {
  totalRevenue: number;
  activeUsers: number;
  todayTickets: number;
  totalWalletBalance: number;
  revenueChart: { date: string; amount: number }[];
  topRoutes: { name: string; tickets: number }[];
  vipDistribution: { level: VipLevel; count: number }[];
}

// ==========================================
// 10. ANNOUNCEMENT & SYSTEM NOTIFICATION
// ==========================================

export interface BannerAnnouncement {
  id: string;
  message: string;
  priority: "info" | "warning" | "urgent";
  duration?: number;
  isActive: boolean;
  createdAt: string;
}
