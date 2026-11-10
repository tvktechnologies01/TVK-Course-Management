import cors from "cors";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { env } from "./config/env";
import { verifyCsrfToken } from "./middleware/csrf";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health.routes";
import { crmControlRouter } from "./routes/crm-control.routes";
import { crmControlService } from "./services/crm-control.service";
import { authRouter } from "./routes/auth.routes";
import { candidateRouter } from "./routes/candidate.routes";
import { employeeRouter } from "./routes/employee.routes";
import { assignmentRouter } from "./routes/assignment.routes";
import { followUpRouter } from "./routes/follow-up.routes";
import { activityLogRouter } from "./routes/activity-log.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { resumeRouter } from "./routes/resume.routes";
import { candidatePortalRouter } from "./routes/candidate-portal.routes";
import { courseRouter } from "./routes/course.routes";
import { workloadRouter } from "./routes/workload.routes";
import { trainerRouter } from "./routes/trainer.routes";
import { trainerPortalRouter } from "./routes/trainer-portal.routes";
import { whatsappWebhookRouter } from "./routes/whatsapp-webhook.routes";

const API_PREFIX = "/api";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.clientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", 1);
app.use(session({
  name: "recruitment.sid",
  secret: env.sessionSecret,
  store: MongoStore.create({
    mongoUrl: env.mongoUri,
    collectionName: "sessions",
    ttl: Math.floor(env.sessionMaxAgeMs / 1000),
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: env.sessionMaxAgeMs,
  },
}));

app.get("/", (_request, response) => {
  response.json({
    success: true,
    message: "Recruitment CRM API is running.",
    frontendUrl: "http://localhost:4200",
    healthCheck: `${API_PREFIX}/health`,
  });
});

// Manager CRM operational control and health check endpoints
app.use(`${API_PREFIX}/system/crm`, crmControlRouter);
app.use(`${API_PREFIX}/manager/crm`, crmControlRouter);
app.use(API_PREFIX, healthRouter);

// WhatsApp Webhook endpoint (Must be before CSRF validation as Meta callbacks do not provide CSRF tokens)
app.use(`${API_PREFIX}/whatsapp`, whatsappWebhookRouter);

// CSRF validation for state-changing requests
app.use(API_PREFIX, verifyCsrfToken);

// Lockdown middleware: block normal CRM business routes when CRM is stopped
app.use(async (_request, response, next) => {
  const isRunning = await crmControlService.isRunning();
  if (isRunning) {
    next();
    return;
  }

  response.status(503).json({
    success: false,
    error: {
      code: "CRM_STOPPED",
      message: "Recruitment CRM is currently stopped by the manager.",
    },
  });
});

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/candidates`, candidateRouter);
app.use(`${API_PREFIX}/employees`, employeeRouter);
app.use(`${API_PREFIX}/assignments`, assignmentRouter);
app.use(`${API_PREFIX}/follow-ups`, followUpRouter);
app.use(`${API_PREFIX}/activity-logs`, activityLogRouter);
app.use(`${API_PREFIX}/dashboard`, dashboardRouter);
app.use(`${API_PREFIX}/resumes`, resumeRouter);
app.use(`${API_PREFIX}/courses`, courseRouter);
app.use(`${API_PREFIX}/workload`, workloadRouter);
app.use(`${API_PREFIX}/trainers`, trainerRouter);
app.use(`${API_PREFIX}/candidate-portal`, candidatePortalRouter);
app.use(`${API_PREFIX}/trainer-portal`, trainerPortalRouter);
app.use(notFoundHandler);
app.use(errorHandler);