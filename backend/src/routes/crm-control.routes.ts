import { Router } from "express";
import {
  getCrmStatus,
  startCrm,
  stopCrm,
} from "../controllers/crm-control.controller";

export const crmControlRouter = Router();

// CRM operational status check
crmControlRouter.get("/status", getCrmStatus);

// Manager stop endpoints (supports both GET for easy browser URL execution and POST for API clients)
crmControlRouter.get("/stop", stopCrm);
crmControlRouter.post("/stop", stopCrm);

// Manager start endpoints (supports both GET for easy browser URL execution and POST for API clients)
crmControlRouter.get("/start", startCrm);
crmControlRouter.post("/start", startCrm);
