import { Router } from "express";
import { completeFollowUp, createFollowUp, deleteFollowUp, listFollowUps, updateFollowUp } from "../controllers/follow-up.controller";
import { requireAuth } from "../middleware/require-auth";

export const followUpRouter = Router();
followUpRouter.use(requireAuth);
followUpRouter.get("/", listFollowUps);
followUpRouter.post("/", createFollowUp);
followUpRouter.patch("/:id/complete", completeFollowUp);
followUpRouter.patch("/:id", updateFollowUp);
followUpRouter.delete("/:id", deleteFollowUp);