import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserModel } from "../models/user.model";
import { authService } from "../services/auth.service";
import { toAuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { bootstrapManagerBodySchema, invitationBodySchema, loginBodySchema, passwordBodySchema } from "../validators/auth.validators";

function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => error ? reject(error) : resolve());
  });
}

function saveSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => error ? reject(error) : resolve());
  });
}

export function signUserToken(payload: { id: string; username: string; role: string; employeeId: string; name: string; email: string }): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

export async function login(request: Request, response: Response): Promise<void> {
  const body = loginBodySchema.parse(request.body);
  const user = await authService.authenticate(body.username, body.password);
  await regenerateSession(request);
  request.session.userId = user.id;
  request.session.csrfToken = crypto.randomUUID() + crypto.randomUUID();
  await saveSession(request);

  const token = signUserToken({
    id: user.id,
    username: user.username,
    role: user.role,
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
  });

  response.json({
    success: true,
    data: {
      user: toAuthenticatedAccount(user),
      csrfToken: request.session.csrfToken,
      token,
    },
  });
}

export async function currentUser(request: Request, response: Response): Promise<void> {
  const token = request.account ? signUserToken({
    id: request.account.id,
    username: request.account.username,
    role: request.account.role,
    employeeId: request.account.employeeId,
    name: request.account.name,
    email: request.account.email,
  }) : undefined;

  response.json({
    success: true,
    data: {
      user: request.account,
      csrfToken: request.session.csrfToken,
      token,
    },
  });
}

export async function logout(request: Request, response: Response, next: NextFunction): Promise<void> {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    response.clearCookie("recruitment.sid", { httpOnly: true, sameSite: "lax", secure: request.secure });
    response.status(204).end();
  });
}

export async function changePassword(request: Request, response: Response): Promise<void> {
  const body = passwordBodySchema.parse(request.body);
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  await authService.changePassword(request.account.id, body.password);
  response.status(204).end();
}

export async function acceptInvitation(request: Request, response: Response): Promise<void> {
  const body = invitationBodySchema.parse(request.body);
  await authService.acceptInvitation(body.token, body.password);
  response.status(204).end();
}

export async function bootstrapManager(request: Request, response: Response): Promise<void> {
  const existingManager = await UserModel.exists({ role: "MANAGER" });
  if (existingManager) throw new HttpError(409, "MANAGER_EXISTS", "A Manager account is already configured.");

  const bootstrapToken = request.get("X-Bootstrap-Token");
  const expectedToken = process.env["BOOTSTRAP_TOKEN"];
  if (!expectedToken || !bootstrapToken) {
    throw new HttpError(404, "NOT_FOUND", "The requested endpoint does not exist.");
  }
  const suppliedBytes = Buffer.from(bootstrapToken);
  const expectedBytes = Buffer.from(expectedToken);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    throw new HttpError(404, "NOT_FOUND", "The requested endpoint does not exist.");
  }

  const parsed = bootstrapManagerBodySchema.parse(request.body);
  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const user = await UserModel.create({
    username: parsed.username.toLowerCase(),
    name: parsed.name,
    email: parsed.email.toLowerCase(),
    employeeId: parsed.employeeId.toUpperCase(),
    phone: "",
    role: "MANAGER",
    active: true,
    passwordHash,
    mustChangePassword: false,
  });
  response.status(201).json({ success: true, data: { user: toAuthenticatedAccount(user) } });
}
