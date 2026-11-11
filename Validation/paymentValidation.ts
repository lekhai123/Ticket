import { z } from "zod";
export const createTopUpSchema = z.object({
  body: z.object({
    amount: z
      .number({ message: "Số tiền phải là số" })
      .min(10000, "Số tiền tối thiểu 10.000đ"),
  }),
});
