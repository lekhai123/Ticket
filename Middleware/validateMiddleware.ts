// FILE: Middleware/validateMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodTypeAny } from "zod";

export class AppError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const validate = (schema: ZodTypeAny) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // 1. Parse & Validate và cast thành `any` để truy cập các thuộc tính body, query, params
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as any;

      // 2. Gán lại dữ liệu đã qua sanitize / transform / coerce
      if (parsed.body !== undefined) {
        req.body = parsed.body;
      }

      if (parsed.query !== undefined) {
        for (const key in req.query) delete req.query[key];
        Object.assign(req.query, parsed.query);
      }

      if (parsed.params !== undefined) {
        for (const key in req.params) delete req.params[key];
        Object.assign(req.params, parsed.params);
      }

      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const issueDetails = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        const errorMessage = issueDetails.map((i) => i.message).join("; ");

        // Đẩy lỗi chuẩn về Global Error Handler
        return next(new AppError(errorMessage, 400, issueDetails));
      }

      next(error);
    }
  };
};
