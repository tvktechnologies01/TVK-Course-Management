import "express-session";
import { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthenticatedAccount, UserModel, UserRole, toAuthenticatedAccount } from "../models/user.model";

declare global {
  namespace Express {
    interface Request {
      account?: AuthenticatedAccount;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}

export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    let userId = request.session?.userId;

    // Check for Authorization: Bearer <token>
    const authHeader = request.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = jwt.verify(token, env.jwtSecret) as { id?: string };
        if (decoded && decoded.id) {
          userId = decoded.id;
          if (request.session) {
            request.session.userId = decoded.id;
            if (!request.session.csrfToken) {
              request.session.csrfToken = crypto.randomUUID() + crypto.randomUUID();
            }
          }
        }
      } catch {
        // If Bearer token is invalid and no valid session exists, reject
        if (!userId) {
          response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Invalid or expired token." } });
          return;
        }
      }
    }

    if (!userId) {
      response.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user || !user.active) {
      if (request.session) {
        request.session.destroy(() => undefined);
      }
      response.clearCookie("recruitment.sid");
      response.status(401).json({ success: false, error: { code: "ACCOUNT_INACTIVE", message: "This account is unavailable." } });
      return;
    }

    request.account = toAuthenticatedAccount(user);
    next();
  } catch (error: unknown) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, response, next) => {
    if (!request.account || !roles.includes(request.account.role)) {
      response.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
      return;
    }
    next();
  };
}