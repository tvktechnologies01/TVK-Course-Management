import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "./error-handler";

declare global {
  namespace Express {
    interface Request {
      trainerUser?: {
        trainerId: string;
        role: "TRAINER";
        email: string;
        name: string;
      };
    }
  }
}

export const requireTrainerAuth: RequestHandler = (request, _response, next) => {
  const authHeader = request.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required."));
    return;
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as {
      sub?: string;
      role?: string;
      trainerId?: string;
      email?: string;
      name?: string;
    };

    if (decoded.role === "TRAINER" && decoded.trainerId) {
      request.trainerUser = {
        trainerId: decoded.trainerId,
        role: "TRAINER",
        email: decoded.email || "",
        name: decoded.name || "",
      };
      next();
      return;
    }

    // Allow staff/managers to inspect trainer portal endpoints if target trainerId is provided
    if (decoded.role === "MANAGER" || decoded.role === "SUPER_ADMIN" || decoded.role === "ADMIN") {
      const targetTrainerId = (request.query["trainerId"] as string) || (request.headers["x-target-trainer-id"] as string);
      if (targetTrainerId) {
        request.trainerUser = {
          trainerId: targetTrainerId,
          role: "TRAINER",
          email: decoded.email || "",
          name: decoded.name || "Manager Preview",
        };
        next();
        return;
      }
    }

    next(new HttpError(403, "FORBIDDEN", "Invalid trainer access token. Please sign in via the Trainer Login page."));
    return;
  } catch {
    next(new HttpError(401, "UNAUTHENTICATED", "Trainer session has expired or is invalid."));
  }
};
