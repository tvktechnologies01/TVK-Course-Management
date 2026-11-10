import { z } from "zod";

export const courseTrackInputSchema = z.object({
  duration: z.string().trim().min(1),
  fees: z.coerce.number().min(0).default(0),
});

export const courseCreateSchema = z.object({
  name: z.string().trim().min(2, "Course name must be at least 2 characters.").max(200),
  code: z.string().trim().max(40).optional().default(""),
  category: z.string().trim().max(100).optional().default("General IT"),
  duration: z.string().trim().max(40).optional().default("3 Months"),
  mode: z.string().trim().max(60).optional().default("Online / Offline"),
  fees: z.coerce.number().min(0).optional().default(0),
  description: z.string().trim().max(4000).optional().default(""),
  keyTopics: z.union([
    z.array(z.string().trim()),
    z.string().transform((str) => str.split(",").map((s) => s.trim()).filter(Boolean)),
  ]).optional().default([]),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
  tracks: z.array(courseTrackInputSchema).optional(),
});

export const courseUpdateSchema = courseCreateSchema.partial();

export const courseQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().default("ALL"),
  hasCurriculum: z.enum(["YES", "NO", "ALL"]).optional().default("ALL"),
});

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
export type CourseQueryInput = z.infer<typeof courseQuerySchema>;
