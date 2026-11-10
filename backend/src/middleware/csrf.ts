import { randomBytes, timingSafeEqual } from "node:crypto";
import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../middleware/error-handler";

export const issueCsrfToken: RequestHandler = (request, response, _next) => {
  if (!request.session.csrfToken) {
    request.session.csrfToken = randomBytes(32).toString("hex");
  }
  response.json({ success: true, data: { csrfToken: request.session.csrfToken } });
};

export const verifyCsrfToken: RequestHandler = (request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }

  // Login, public registration, payment link proof submission, forgot password, and contact manager establish initial contact without prior session
  if (
    request.path === "/auth/login" ||
    request.path.endsWith("/auth/login") ||
    request.path === "/candidates/register" ||
    request.path.endsWith("/candidates/register") ||
    request.path === "/candidate-portal/login" ||
    request.path.endsWith("/candidate-portal/login") ||
    request.path === "/trainer-portal/login" ||
    request.path.endsWith("/trainer-portal/login") ||
    request.path.includes("/candidate-portal/payment-link/") ||
    request.path.endsWith("/candidate-portal/forgot-password") ||
    request.path.endsWith("/candidate-portal/reset-password") ||
    request.path.endsWith("/candidate-portal/contact-manager") ||
    request.path.includes("/contact-manager")
  ) {
    next();
    return;
  }

  // Pure JWT authenticated requests are protected against browser CSRF
  const authHeader = request.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      if (decoded) {
        next();
        return;
      }
    } catch {
      // Continue to CSRF validation below
    }
  }

  const expected = request.session?.csrfToken;
  const provided = request.get("X-CSRF-Token");
  if (!expected || !provided) {
    next(new HttpError(403, "CSRF_INVALID", "Request verification failed."));
    return;
  }

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    next(new HttpError(403, "CSRF_INVALID", "Request verification failed."));
    return;
  }

  next();
};