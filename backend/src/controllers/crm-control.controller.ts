import { Request, Response } from "express";
import { crmControlService } from "../services/crm-control.service";

export async function getCrmStatus(_request: Request, response: Response): Promise<void> {
  const isRunning = await crmControlService.isRunning();
  response.json({
    success: true,
    data: {
      crm: isRunning ? "running" : "stopped",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function stopCrm(request: Request, response: Response): Promise<void> {
  const actor = request.account?.name || "Admin";
  await crmControlService.setRunning(false, actor);

  response.json({
    success: true,
    data: {
      crm: "stopped",
      message: "Recruitment CRM has been STOPPED successfully. Access is now closed to users.",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function startCrm(request: Request, response: Response): Promise<void> {
  const actor = request.account?.name || "Admin";
  await crmControlService.setRunning(true, actor);

  response.json({
    success: true,
    data: {
      crm: "running",
      message: "Recruitment CRM has been STARTED successfully. Login and CRM are now accessible.",
      timestamp: new Date().toISOString(),
    },
  });
}
