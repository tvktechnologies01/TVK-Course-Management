import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { issueCsrfToken, verifyCsrfToken } from "../middleware/csrf";
import { requireAuth } from "../middleware/require-auth";
import { acceptInvitation, bootstrapManager, changePassword, currentUser, login, logout } from "../controllers/auth.controller";

export const authRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again later." } },
});

authRouter.post("/login", loginLimiter, login);
authRouter.get("/csrf", issueCsrfToken);
authRouter.get("/me", requireAuth, currentUser);
authRouter.post("/logout", requireAuth, verifyCsrfToken, logout);
authRouter.post("/password", requireAuth, verifyCsrfToken, changePassword);
authRouter.post("/invitations/accept", verifyCsrfToken, acceptInvitation);
authRouter.post("/bootstrap-manager", verifyCsrfToken, bootstrapManager);