import { Router, Request, Response } from "express";
import { activityLogService } from "../services/activity-log.service";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const activityLogRouter = Router();
activityLogRouter.use(requireAuth, requireRole("MANAGER"));

export async function listActivityLogs(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await activityLogService.list(request.query) });
}

activityLogRouter.get("/", listActivityLogs);
