import { Request, Response } from "express";
import { assignmentService } from "../services/assignment.service";
import { HttpError } from "../middleware/error-handler";
import { assignCandidatesSchema, assignmentListQuerySchema, updateAssignmentSchema } from "../validators/assignment.validators";
import { idParamSchema } from "../validators/candidate.validators";

function actor(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

export async function listAssignments(request: Request, response: Response): Promise<void> {
  const query = assignmentListQuerySchema.parse(request.query);
  const employeeId = actor(request).role === "HR" ? actor(request).employeeId : query.employeeId;
  response.json({ success: true, data: await assignmentService.list(query.page, query.pageSize, employeeId) });
}

export async function assignCandidates(request: Request, response: Response): Promise<void> {
  const body = assignCandidatesSchema.parse(request.body);
  const items = await assignmentService.assign(body.candidateIds, body.employeeId, actor(request));
  response.json({ success: true, data: { items } });
}

export async function reassignCandidate(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const body = updateAssignmentSchema.parse(request.body);
  const items = await assignmentService.assign([id], body.employeeId, actor(request));
  response.json({ success: true, data: items[0] });
}
