import { ErrorRequestHandler, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    response.status(tooLarge ? 413 : 400).json({
      success: false,
      error: { code: tooLarge ? "UPLOAD_TOO_LARGE" : "UPLOAD_INVALID", message: tooLarge ? "The uploaded resume exceeds the allowed file size." : "The resume upload is invalid." },
    });
    return;
  }
  if (error instanceof ZodError) {
    const combinedMessage = error.issues
      .map((i) => `${i.path.join(".") || "field"}: ${i.message}`)
      .join("; ");
    response.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: combinedMessage || "Request validation failed.", details: error.issues },
    });
    return;
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : 500;

  if (statusCode >= 500) {
    console.error("Unhandled API error:", error);
  }

  response.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    success: false,
    error: {
      code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
      message: statusCode >= 500 ? "An unexpected error occurred." : message,
    },
  });
};

export const notFoundHandler = (_request: unknown, response: Response): void => {
  response.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "The requested endpoint does not exist." },
  });
};