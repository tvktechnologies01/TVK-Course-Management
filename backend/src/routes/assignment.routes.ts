import { Router } from "express";
import { assignCandidates, listAssignments, reassignCandidate } from "../controllers/assignment.controller";
import { requireAuth } from "../middleware/require-auth";

export const assignmentRouter = Router();
assignmentRouter.use(requireAuth);
assignmentRouter.get("/", listAssignments);
assignmentRouter.post("/", assignCandidates);
assignmentRouter.patch("/:id", reassignCandidate);