import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "./error-handler";

declare global {
  namespace Express {
    interface Request {
      candidateUser?: {
        candidateId: string;
        role: "CANDIDATE";
      };
    }
  }
}

export const requireCandidateAuth: RequestHandler = (request, _response, next) => {
  const authHeader = request.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new HttpError(401, "UNAUTHENTICATED", "Candidate authentication required."));
    return;
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { sub?: string; role?: string; candidateId?: string };
    if (decoded.role !== "CANDIDATE" || !decoded.candidateId) {
      next(new HttpError(403, "FORBIDDEN", "Invalid candidate access token."));
      return;
    }
    request.candidateUser = {
      candidateId: decoded.candidateId,
      role: "CANDIDATE",
    };
    next();
  } catch {
    next(new HttpError(401, "UNAUTHENTICATED", "Candidate session has expired or is invalid."));
  }
};
