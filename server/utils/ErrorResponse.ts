import { Response } from "express";

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ExternalApiError extends HttpError {
  public readonly cause?: unknown;

  constructor(message: string, details?: unknown, statusCode = 502) {
    super(statusCode, message, details);
    this.name = "ExternalApiError";
    this.cause = details;
  }
}

export class ErrorResponse {
  static handle(error: unknown, res: Response) {
    const isProduction = process.env.NODE_ENV === "production";
    let statusCode = 500;
    let message = "Error interno del servidor";
    let details: unknown;

    if (error instanceof HttpError) {
      statusCode = error.statusCode;
      message = error.message || message;
      details = error.details;
    } else if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
    ) {
      const errObj = error as { statusCode: number; message?: string; details?: unknown };
      statusCode = errObj.statusCode;
      message = errObj.message || message;
      details = errObj.details;
    } else if (error instanceof Error) {
      message = error.message || message;
    }

    if (statusCode < 400 || statusCode >= 600) {
      statusCode = 500;
    }

    if (error instanceof ExternalApiError && (statusCode < 500 || statusCode >= 600)) {
      statusCode = 502;
    }

    console.error("[ErrorResponse]", message, error);

    const payload: Record<string, unknown> = { error: message };
    if (!isProduction && details !== undefined) {
      payload.details = details;
    }

    if (!isProduction && error instanceof Error && error.stack) {
      payload.stack = error.stack;
    }

    return res.status(statusCode).json(payload);
  }
}
