import { z } from "zod";

export const followUpListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  completed: z.enum(["true", "false"]).optional(),
  candidateId: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["asc", "desc"]).default("asc"),
}).strict();

export const followUpCreateSchema = z.object({
  candidateId: z.string().trim().min(1).max(120),
  scheduledAt: z.coerce.date(),
  notes: z.string().trim().max(4000).default(""),
}).strict();

export const followUpPatchSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().trim().max(4000).optional(),
  completed: z.boolean().optional(),
}).strict().refine((changes) => Object.keys(changes).length > 0, "At least one follow-up field must be supplied.");

export const followUpIdParamSchema = z.object({ id: z.string().trim().min(1).max(120) }).strict();