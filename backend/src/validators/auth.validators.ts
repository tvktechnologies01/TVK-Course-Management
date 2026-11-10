import { z } from "zod";

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
}).strict();

export const passwordBodySchema = z.object({
  password: z.string().min(12).max(200),
}).strict();

export const invitationBodySchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(12).max(200),
}).strict();

export const bootstrapManagerBodySchema = z.object({
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(12).max(200),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  employeeId: z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
}).strict();