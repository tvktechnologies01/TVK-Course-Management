import { Router } from "express";
import {
  createEmployee,
  deleteEmployee,
  employeeCandidates,
  employeePerformance,
  getEmployee,
  listEmployees,
  setEmployeeActive,
  updateEmployee,
} from "../controllers/employee.controller";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const employeeRouter = Router();
employeeRouter.use(requireAuth, requireRole("MANAGER"));
employeeRouter.get("/", listEmployees);
employeeRouter.post("/", createEmployee);
employeeRouter.get("/:id/candidates", employeeCandidates);
employeeRouter.get("/:id/performance", employeePerformance);
employeeRouter.patch("/:id/status", setEmployeeActive);
employeeRouter.patch("/:id", updateEmployee);
employeeRouter.delete("/:id", deleteEmployee);
employeeRouter.get("/:id", getEmployee);