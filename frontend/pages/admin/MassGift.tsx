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
      .number({ message: "Nhập số tiền" })
      .min(1000, "Tối thiểu 1,000 VNĐ"),
    batchId: z.string().min(5, "Batch ID ít nhất 5 ký tự"),
    reason: z.string().min(10, "Lý do ít nhất 10 ký tự"),
  })
  .refine(
    (data) =>
      data.targetType !== "SINGLE" ||
      (data.targetId && data.targetId.trim() !== ""),
    { message: "Nhập User ID", path: ["targetId"] },
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
      alert(`🎉 Phát quà thành công!`);
      reset();
    },
    onError: (err: any) => alert(err?.message || "Lỗi khi phát quà"),
  });

  const onSubmit: SubmitHandler<MassGiftForm> = (data) => {
    if (
      confirm(
        `XÁC NHẬN PHÁT QUÀ: ${data.amount.toLocaleString()} ₫ cho ${data.targetType === "ALL" ? "TOÀN BỘ" : "User ID: " + data.targetId}?`,
      )
    ) {
      giftMutation.mutate(data);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2 text-[#F5F5F7]">
          <Gift className="h-5 w-5 text-[#8B5CF6]" /> Tặng tiền (Mass Gift)
        </h1>
        <p className="text-sm text-[#92929F] mt-1">
          Công cụ phát tiền hàng loạt.
        </p>
      </div>

      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex gap-3 text-sm text-rose-300">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-rose-400" />
        <p>
          Cảnh báo: Thao tác tác động trực tiếp đến số dư ví. Bắt buộc có Batch
          ID để Rollback.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#15151B] p-6"
      >
        <div className="space-y-3">
          <label className="text-sm font-medium text-[#F5F5F7]">
            Đối tượng nhận
          </label>
          <div className="grid grid-cols-2 gap-4">
            {(["ALL", "SINGLE"] as const).map((type) => (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all",
                  targetType === type
                    ? "border-[#8B5CF6] bg-[#8B5CF6]/10 text-[#8B5CF6]"
                    : "border-white/[0.08] bg-[#0D0D10] text-[#92929F] hover:border-white/[0.15]",
                )}
              >
                <input
                  type="radio"
                  value={type}
                  className="hidden"
                  {...register("targetType")}
                />
                {type === "ALL" ? (
                  <Users className="h-5 w-5" />
                ) : (
                  <Target className="h-5 w-5" />
                )}
                <span className="text-sm font-medium">
                  {type === "ALL" ? "Toàn Server" : "Một User"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {targetType === "SINGLE" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#F5F5F7]">
              User ID
            </label>
            <Input
              {...register("targetId")}
              placeholder="Nhập ID (VD: 1)..."
              error={errors.targetId?.message}
              className="bg-[#0D0D10] border-white/[0.08] text-[#F5F5F7]"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#F5F5F7]">
              Số tiền (VNĐ)
            </label>
            <Input
              type="number"
              {...register("amount", { valueAsNumber: true })}
              error={errors.amount?.message}
              className="bg-[#0D0D10] border-white/[0.08] text-[#F5F5F7]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[#F5F5F7]">
              Batch ID
            </label>
            <Input
              {...register("batchId")}
              placeholder="EVENT_TET..."
              className="uppercase font-mono bg-[#0D0D10] border-white/[0.08] text-[#F5F5F7]"
              error={errors.batchId?.message}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[#F5F5F7]">Lý do</label>
          <Input
            {...register("reason")}
            placeholder="Ghi chú lý do..."
            error={errors.reason?.message}
            className="bg-[#0D0D10] border-white/[0.08] text-[#F5F5F7]"
          />
        </div>

        <Button
          type="submit"
          className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
          isLoading={giftMutation.isPending}
        >
          Xác nhận Phát tiền
        </Button>
      </form>
    </div>
  );
}
