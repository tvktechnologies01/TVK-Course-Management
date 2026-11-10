import { Request, Response } from "express";
import { followUpService } from "../services/follow-up.service";
import { HttpError } from "../middleware/error-handler";
import { followUpCreateSchema, followUpIdParamSchema, followUpPatchSchema } from "../validators/follow-up.validators";

function actor(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

export async function listFollowUps(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await followUpService.list(request.query, actor(request)) });
}

export async function createFollowUp(request: Request, response: Response): Promise<void> {
  const followUp = await followUpService.create(followUpCreateSchema.parse(request.body), actor(request));
  response.status(201).json({ success: true, data: followUp });
}

export async function updateFollowUp(request: Request, response: Response): Promise<void> {
  const { id } = followUpIdParamSchema.parse(request.params);
  const followUp = await followUpService.update(id, followUpPatchSchema.parse(request.body), actor(request));
  response.json({ success: true, data: followUp });
}

export async function completeFollowUp(request: Request, response: Response): Promise<void> {
  const { id } = followUpIdParamSchema.parse(request.params);
  response.json({ success: true, data: await followUpService.update(id, { completed: true }, actor(request)) });
}

export async function deleteFollowUp(request: Request, response: Response): Promise<void> {
  const { id } = followUpIdParamSchema.parse(request.params);
  await followUpService.remove(id, actor(request));
  response.status(204).end();
}
