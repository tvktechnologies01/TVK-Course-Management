import { z } from "zod";

export const assignCandidatesSchema = z.object({
  candidateIds: z.array(z.string().trim().min(1).max(120)).min(1).max(100),
  employeeId: z.string().trim().min(1).max(80),
}).strict().refine((value) => new Set(value.candidateIds).size === value.candidateIds.length, {
  message: "Candidate IDs must be unique.",
  path: ["candidateIds"],
});

export const updateAssignmentSchema = z.object({
  employeeId: z.string().trim().min(1).max(80),
}).strict();

export const assignmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  employeeId: z.string().trim().max(80).optional(),
}).strict();
