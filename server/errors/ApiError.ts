export type ApiErrorOptions = {
  code?: string;
  isSafe?: boolean;
  details?: unknown;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly isSafe: boolean;
  public readonly details?: unknown;

  constructor(status: number, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options.code ?? "API_ERROR";
    this.isSafe = options.isSafe ?? true;
    this.details = options.details;
  }

  static badRequest(message: string, options?: ApiErrorOptions) {
    return new ApiError(400, message, { code: "BAD_REQUEST", ...options });
  }

  static notFound(message: string, options?: ApiErrorOptions) {
    return new ApiError(404, message, { code: "NOT_FOUND", ...options });
  }

  static conflict(message: string, options?: ApiErrorOptions) {
    return new ApiError(409, message, { code: "CONFLICT", ...options });
  }
}
