import { Router, RequestHandler } from "express";
import mongoose from "mongoose";
import { crmControlService } from "../services/crm-control.service";

export const healthRouter = Router();

export const healthCheck: RequestHandler = async (_request, response) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const isCrmRunning = await crmControlService.isRunning();
  const isOk = databaseConnected && isCrmRunning;

  response.status(isOk ? 200 : 503).json({
    success: isOk,
    data: {
      status: isOk ? "ok" : isCrmRunning ? "unavailable" : "stopped",
      database: databaseConnected ? "connected" : "disconnected",
      crm: isCrmRunning ? "running" : "stopped",
      timestamp: new Date().toISOString(),
    },
  });
};

healthRouter.get("/health", healthCheck);
