import { Request, Response } from "express";
import { employeeService } from "../services/employee.service";
import { HttpError } from "../middleware/error-handler";
import { idParamSchema } from "../validators/candidate.validators";
import { paginationQuerySchema } from "../validators/common.validators";
import { createHrBodySchema, employeeStatusBodySchema, updateHrBodySchema } from "../validators/employee.validators";

function actor(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

function employeeId(request: Request): string {
  return idParamSchema.parse(request.params).id;
}

export async function listEmployees(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await employeeService.list(request.query) });
}

export async function createEmployee(request: Request, response: Response): Promise<void> {
  const created = await employeeService.create(createHrBodySchema.parse(request.body), actor(request));
  response.status(201).json({ success: true, data: created });
}

export async function getEmployee(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await employeeService.get(employeeId(request)) });
}

export async function updateEmployee(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await employeeService.update(employeeId(request), updateHrBodySchema.parse(request.body), actor(request)) });
}

export async function setEmployeeActive(request: Request, response: Response): Promise<void> {
  const { active } = employeeStatusBodySchema.parse(request.body);
  response.json({ success: true, data: await employeeService.setActive(employeeId(request), active, actor(request)) });
}

export async function employeeCandidates(request: Request, response: Response): Promise<void> {
  const query = paginationQuerySchema.parse(request.query);
  response.json({ success: true, data: await employeeService.assignedCandidates(employeeId(request), actor(request), query.page, query.pageSize) });
}

export async function employeePerformance(request: Request, response: Response): Promise<void> {
  response.json({ success: true, data: await employeeService.performance(employeeId(request)) });
}

export async function deleteEmployee(request: Request, response: Response): Promise<void> {
  const result = await employeeService.delete(employeeId(request), actor(request));
  response.json({ success: true, data: result });
}
