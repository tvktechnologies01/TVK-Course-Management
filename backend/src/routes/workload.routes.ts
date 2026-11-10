import { Router } from "express";
import {
  getWorkloadOverview,
  getHrWorkloadDetails,
  getWorkloadCandidates,
  assignWorkloadCandidates,
  getWorkloadAssignmentHistory,
  getWorkloadActivityFeed,
} from "../controllers/workload.controller";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const workloadRouter = Router();

workloadRouter.use(requireAuth, requireRole("MANAGER"));

workloadRouter.get("/overview", getWorkloadOverview);
workloadRouter.get("/hr/:employeeId", getHrWorkloadDetails);
workloadRouter.get("/candidates", getWorkloadCandidates);
workloadRouter.post("/assign", assignWorkloadCandidates);
workloadRouter.get("/history", getWorkloadAssignmentHistory);
workloadRouter.get("/activities", getWorkloadActivityFeed);
