import { z } from "zod";

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(200).optional(),
  active: z.enum(["true", "false"]).optional(),
}).passthrough();

export const createHrBodySchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(80, "Username cannot exceed 80 characters").regex(/^[a-zA-Z0-9._@-]+$/, "Username can only contain letters, numbers, dots, hyphens, and @"),
  name: z.string().trim().min(1, "Full name is required").max(120, "Name cannot exceed 120 characters"),
  email: z.string().trim().email("Please enter a valid email address").max(254, "Email is too long"),
  employeeId: z.string().trim().min(1, "Employee ID is required").max(40, "Employee ID cannot exceed 40 characters").regex(/^[a-zA-Z0-9._ -]+$/, "Employee ID contains invalid characters"),
  phone: z.string().trim().max(40).default(""),
  password: z.string().trim().min(6, "Password must be at least 6 characters").max(200),
}).passthrough();

export const updateHrBodySchema = createHrBodySchema
  .omit({ username: true })
  .partial()
  .passthrough()
  .refine((changes) => Object.keys(changes).length > 0, "At least one HR profile field must be supplied.");

export const employeeStatusBodySchema = z.object({ active: z.boolean() }).passthrough();