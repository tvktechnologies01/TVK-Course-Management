import "dotenv/config";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/recruitment_crm"),
  SESSION_SECRET: z.string().min(32).optional(),
  CLIENT_ORIGINS: z.string().default("http://127.0.0.1:4200,http://localhost:4200"),
  SESSION_MAX_AGE_HOURS: z.coerce.number().positive().default(6),
  JWT_SECRET: z.string().min(16).optional(),
  JWT_EXPIRES_IN: z.string().default("6h"),
  MAX_RESUME_SIZE_MB: z.coerce.number().positive().max(20).default(5),
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().trim().optional(),
  SMTP_SSH_HOST: z.string().trim().optional(),
  SMTP_SSH_PORT: z.coerce.number().int().min(1).max(65535).optional().default(22),
  SMTP_SSH_USER: z.string().trim().optional(),
  SMTP_SSH_PASS: z.string().optional(),
  WHATSAPP_TOKEN: z.string().trim().optional(),
  WHATSAPP_PHONE_ID: z.string().trim().optional(),
  WHATSAPP_ACCOUNT_ID: z.string().trim().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().trim().optional().default("tvm_recruitment_webhook_token_2026"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid backend environment: ${parsed.error.message}`);
}

if (parsed.data.NODE_ENV === "production" && !parsed.data.SESSION_SECRET && !parsed.data.JWT_SECRET) {
  throw new Error("SESSION_SECRET or JWT_SECRET must be configured in production.");
}

const defaultSecret = randomBytes(32).toString("hex");

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  mongoUri: parsed.data.MONGODB_URI,
  sessionSecret: parsed.data.SESSION_SECRET ?? defaultSecret,
  jwtSecret: parsed.data.JWT_SECRET ?? parsed.data.SESSION_SECRET ?? defaultSecret,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  clientOrigins: parsed.data.CLIENT_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  sessionMaxAgeHours: parsed.data.SESSION_MAX_AGE_HOURS,
  sessionMaxAgeMs: parsed.data.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000,
  maxResumeSizeBytes: parsed.data.MAX_RESUME_SIZE_MB * 1024 * 1024,
  isProduction: parsed.data.NODE_ENV === "production",
  smtp: {
    host: parsed.data.SMTP_HOST || (parsed.data.SMTP_USER?.includes("@gmail.com") ? "smtp.gmail.com" : undefined),
    port: parsed.data.SMTP_PORT ?? (parsed.data.SMTP_HOST?.includes("gmail") || parsed.data.SMTP_USER?.includes("@gmail.com") ? 465 : 587),
    secure: parsed.data.SMTP_SECURE ?? (parsed.data.SMTP_PORT === 465 || parsed.data.SMTP_HOST?.includes("gmail") || (parsed.data.SMTP_USER ? parsed.data.SMTP_USER.includes("@gmail.com") : false)),
    user: parsed.data.SMTP_USER,
    pass: parsed.data.SMTP_PASS,
    from: parsed.data.SMTP_FROM || parsed.data.SMTP_USER,
    ssh: {
      host: parsed.data.SMTP_SSH_HOST,
      port: parsed.data.SMTP_SSH_PORT,
      user: parsed.data.SMTP_SSH_USER,
      pass: parsed.data.SMTP_SSH_PASS,
    },
  },
  whatsapp: {
    token: parsed.data.WHATSAPP_TOKEN,
    phoneId: parsed.data.WHATSAPP_PHONE_ID,
    accountId: parsed.data.WHATSAPP_ACCOUNT_ID,
    verifyToken: parsed.data.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  },
};