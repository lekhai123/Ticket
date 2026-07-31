import React from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Gift, AlertTriangle, Users, Target } from "lucide-react";
import { adminApi } from "../../api/admin.api";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { cn } from "../../utils/cn";

const massGiftSchema = z
  .object({
    targetType: z.enum(["ALL", "SINGLE"]),
    targetId: z.string().optional(),
    giftType: z.enum(["MONEY", "VOUCHER"]),
    amount: z
      .number({ message: "Vui lòng nhập số tiền hợp lệ" })
      .min(1000, "Số tiền tối thiểu là 1,000 VNĐ"),
    batchId: z
      .string()
      .min(5, "Batch ID phải dài ít nhất 5 ký tự (VD: EVENT_TET_2026)"),
    reason: z.string().min(10, "Vui lòng nhập lý do rõ ràng để lưu Audit Log"),
  })
  .refine(
    (data) => {
      if (
        data.targetType === "SINGLE" &&
        (!data.targetId || !data.targetId.trim())
      ) {
        return false;
      }
      return true;
    },
    { message: "Vui lòng nhập User ID", path: ["targetId"] },
  );

type MassGiftForm = z.infer<typeof massGiftSchema>;

export default function MassGift() {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<MassGiftForm>({
    resolver: zodResolver(massGiftSchema),
    defaultValues: {
      targetType: "SINGLE",
      giftType: "MONEY",
      amount: 50000,
      targetId: "",
      batchId: "",
      reason: "",
    },
  });

  const targetType = watch("targetType");

  const giftMutation = useMutation({
    mutationFn: (data: MassGiftForm) => adminApi.massGift(data as any),
    onSuccess: (res: any) => {
      const giftedCount =
        res?.data?.totalUsersGifted || res?.data?.data?.totalUsersGifted || 1;
      alert(`🎉 Phát quà thành công cho ${giftedCount} tài khoản!`);
      reset();
    },
    onError: (err: any) =>
      alert(err?.response?.data?.message || err?.message || "Lỗi khi phát quà"),
  });

  const onSubmit: SubmitHandler<MassGiftForm> = (data) => {
    const targetText =
      data.targetType === "ALL"
        ? "TOÀN SERVER (Tất cả CUSTOMER)"
        : `User ID: ${data.targetId}`;

    const isConfirmed = confirm(
      `⚠️ XÁC NHẬN PHÁT QUÀ:\n\n` +
        `• Số tiền: ${data.amount.toLocaleString()} ₫\n` +
        `• Đối tượng: ${targetText}\n` +
        `• Mã Batch ID: ${data.batchId}\n\n` +
        `Hành động này sẽ cộng tiền trực tiếp vào ví và lưu vết Audit Log. Bạn có chắc chắn muốn thực hiện?`,
    );

    if (isConfirmed) {
      giftMutation.mutate(data);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pt-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-indigo-500" /> Mass Gift Center
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Công cụ phát tiền, voucher hàng loạt. Lưu ý kiểm tra kỹ trước khi thực
          hiện.
        </p>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-400">
            <strong>Khu vực nguy hiểm:</strong> Mọi thao tác tại đây đều tác
            động trực tiếp đến số dư thực tế. Bắt buộc có Batch ID để Rollback
            nếu có sự cố.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="space-y-3">
          <label className="text-sm font-semibold">Đối tượng nhận thưởng</label>
          <div className="grid grid-cols-2 gap-4">
            {(["ALL", "SINGLE"] as const).map((type) => (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 transition-all",
                  targetType === type
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500"
                    : "border-zinc-200 hover:border-indigo-200 dark:border-zinc-800",
                )}
              >
                <input
                  type="radio"
                  value={type}
                  className="hidden"
                  {...register("targetType")}
                />
                {type === "ALL" ? (
                  <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Target className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                )}
                <span className="text-sm font-medium">
                  {type === "ALL" ? "Toàn Server" : "Một User Cụ Thể"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {targetType === "SINGLE" && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">User ID</label>
            <Input
              {...register("targetId")}
              placeholder="Nhập ID người dùng (ví dụ: 1)..."
              error={errors.targetId?.message}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Số tiền phát (VNĐ)</label>
            <Input
              type="number"
              {...register("amount", { valueAsNumber: true })}
              placeholder="50000"
              error={errors.amount?.message}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">
              Batch ID (Mã đợt phát)
            </label>
            <Input
              {...register("batchId")}
              placeholder="VD: EVENT_TET_2026"
              className="uppercase font-mono"
              error={errors.batchId?.message}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Lý do (Lưu vào Audit Log)
          </label>
          <Input
            {...register("reason")}
            placeholder="Ghi chú rõ ràng lý do phát quà (tối thiểu 10 ký tự)..."
            error={errors.reason?.message}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12"
          isLoading={giftMutation.isPending}
        >
          Xác nhận phát tiền
        </Button>
      </form>
    </div>
  );
}
