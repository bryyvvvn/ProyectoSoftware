import { Response } from "express";

export class ErrorResponse {
  static handle(error: unknown, res: Response) {
    console.error("❌ Error:", error);

    const normalizedError = error instanceof Error ? error : new Error("Unexpected error");
    const statusCode = this.resolveStatusCode(normalizedError);
    const isServerError = statusCode >= 500;
    const payload: Record<string, unknown> = {
      error: isServerError
        ? statusCode === 502
          ? "Error comunicación servicio externo"
          : "Error interno del servidor"
        : normalizedError.message,
    };

    if (isServerError && process.env.NODE_ENV === "development") {
      payload.details = normalizedError.message;
    }

    return res.status(statusCode).json(payload);
  }

  private static resolveStatusCode(error: Error): number {
    const explicitStatus = (error as { statusCode?: number }).statusCode;
    if (typeof explicitStatus === "number") {
      return explicitStatus;
    }

    const isExternal =
      (error as { isExternal?: boolean }).isExternal ||
      /external api|servicio externo|http/i.test(error.message);

    return isExternal ? 502 : 500;
  }
}
