import { Router, Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service";
import { HttpError } from "../middleware/error-handler";
import { requireAuth } from "../middleware/require-auth";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

export async function getDashboardSummary(request: Request, response: Response): Promise<void> {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  response.json({ success: true, data: await dashboardService.summary(request.account) });
}

dashboardRouter.get("/summary", getDashboardSummary);
