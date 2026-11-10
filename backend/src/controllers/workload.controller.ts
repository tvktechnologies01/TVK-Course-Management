import { Request, Response } from "express";
import { workloadService } from "../services/workload.service";
import { HttpError } from "../middleware/error-handler";
import { z } from "zod";

function actor(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

const assignWorkloadSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1, "Select at least one candidate."),
  employeeId: z.string().min(1, "Select an HR member."),
  reason: z.string().trim().max(1000).optional(),
});

export async function getWorkloadOverview(_request: Request, response: Response): Promise<void> {
  const data = await workloadService.getOverview();
  response.json({ success: true, data });
}

export async function getHrWorkloadDetails(request: Request, response: Response): Promise<void> {
  const employeeId = String(request.params["employeeId"] || "");
  if (!employeeId) throw new HttpError(400, "BAD_REQUEST", "HR Employee ID required.");
  const data = await workloadService.getHrDetails(employeeId);
  response.json({ success: true, data });
}

export async function getWorkloadCandidates(request: Request, response: Response): Promise<void> {
  const { search, hrId, stage, page, pageSize } = request.query;
  const data = await workloadService.getCandidates({
    search: search ? String(search) : undefined,
    hrId: hrId ? String(hrId) : undefined,
    stage: stage ? String(stage) : undefined,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  response.json({ success: true, data });
}

export async function assignWorkloadCandidates(request: Request, response: Response): Promise<void> {
  const body = assignWorkloadSchema.parse(request.body);
  const items = await workloadService.assignCandidates(
    body.candidateIds,
    body.employeeId,
    body.reason,
    actor(request),
  );
  response.json({ success: true, data: { items } });
}

export async function getWorkloadAssignmentHistory(request: Request, response: Response): Promise<void> {
  const candidateId = request.query["candidateId"] ? String(request.query["candidateId"]) : undefined;
  const limit = request.query["limit"] ? Number(request.query["limit"]) : 50;
  const data = await workloadService.getAssignmentHistory(candidateId, limit);
  response.json({ success: true, data });
}

export async function getWorkloadActivityFeed(request: Request, response: Response): Promise<void> {
  const limit = request.query["limit"] ? Number(request.query["limit"]) : 50;
  const data = await workloadService.getActivityFeed(limit);
  response.json({ success: true, data });
}
