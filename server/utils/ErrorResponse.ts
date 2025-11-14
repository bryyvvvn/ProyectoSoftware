import { Response } from "express";

interface KnownError extends Error {
  status?: number;
  statusCode?: number;
  details?: unknown;
}

/**
 * Utilidad para manejar respuestas de error de forma consistente.
 */
export class ErrorResponse {
  /**
   * Maneja y envía una respuesta de error al cliente.
   * @param error Error capturado
   * @param res Response de Express
   * @returns Respuesta HTTP con el estado y mensaje correspondiente
   */
  public static handle(error: unknown, res: Response): Response {
    const isDevelopment = process.env.NODE_ENV !== "production";
    const defaultMessage = "Error interno del servidor";

    let status = 500;
    let message = defaultMessage;
    let details: unknown;

    if (error instanceof Error) {
      const knownError = error as KnownError;
      status = knownError.status ?? knownError.statusCode ?? status;
      message = knownError.message || message;
      details = knownError.details;
    } else if (typeof error === "string") {
      message = error;
    }

    if (!status || status < 400 || status > 599) {
      status = 500;
    }

    if (status >= 500 && status !== 502) {
      message = defaultMessage;
    }

    console.error("❌ Error procesando solicitud:", error);

    const payload: Record<string, unknown> = { error: message || defaultMessage };
    if (isDevelopment && details) {
      payload.details = details;
    }
    if (isDevelopment && error instanceof Error && error.stack) {
      payload.stack = error.stack;
    }

    return res.status(status).json(payload);
  }
}
