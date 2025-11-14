import { NextFunction, Request, Response } from "express";
import { ApiError } from "../errors/ApiError";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.isSafe ? err.message : "Unexpected server error",
        details: err.details,
      },
    });
  }

  console.error("Unexpected error", err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
    },
  });
}
