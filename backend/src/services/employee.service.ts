import bcrypt from "bcryptjs";
import mongoose, { FilterQuery } from "mongoose";
import { ActivityLogModel } from "../models/activity-log.model";
import { CandidateModel, CandidateRecord } from "../models/candidate.model";
import { UserModel, UserRecord } from "../models/user.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { paginationResult } from "../validators/common.validators";
import { employeeListQuerySchema } from "../validators/employee.validators";
import { authService } from "./auth.service";

function hrQuery(id: string): FilterQuery<UserRecord> {
  const isObjectId = mongoose.isValidObjectId(id);
  return {
    ...(isObjectId ? { $or: [{ _id: id }, { employeeId: id }] } : { employeeId: id }),
    role: "HR",
  };
}

function publicEmployee(user: UserRecord & { _id: unknown; createdAt?: Date; updatedAt?: Date }) {
  return {
    id: user.employeeId,
    accountId: String(user._id),
    username: user.username,
    name: user.name,
    email: user.email,
    employeeId: user.employeeId,
    phone: user.phone,
    role: user.role,
    active: user.active,
    currentPassword: user.currentPassword ?? "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class EmployeeService {
  async list(rawQuery: unknown) {
    const query = employeeListQuerySchema.parse(rawQuery);
    const filter: FilterQuery<UserRecord> = { role: "HR" };
    if (query.active) filter.active = query.active === "true";
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(escaped, "i");
      filter.$or = [{ name: expression }, { email: expression }, { employeeId: expression }, { username: expression }];
    }
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort({ name: 1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize).lean(),
      UserModel.countDocuments(filter),
    ]);
    return { items: items.map((user) => publicEmployee(user)), pagination: paginationResult(total, query.page, query.pageSize) };
  }

  async get(id: string) {
    const user = await UserModel.findOne(hrQuery(id)).lean();
    if (!user) throw new HttpError(404, "HR_NOT_FOUND", "HR account not found.");
    return publicEmployee(user);
  }

  async create(input: { username: string; name: string; email: string; employeeId: string; phone: string; password: string }, actor: AuthenticatedAccount) {
    const rawPassword = input.password.trim();
    const cleanUsername = input.username.trim().toLowerCase();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanEmployeeId = input.employeeId.trim().toUpperCase();

    // Proactively check for existing records to provide immediate, specific error messages
    const existing = await UserModel.findOne({
      $or: [
        { username: cleanUsername },
        { email: cleanEmail },
        { employeeId: cleanEmployeeId },
      ],
    }).lean();

    if (existing) {
      if (existing.username === cleanUsername) {
        throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", `Username '${cleanUsername}' is already taken. Please choose another username.`);
      }
      if (existing.email === cleanEmail) {
        throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", `Email '${cleanEmail}' is already registered to another user.`);
      }
      if (existing.employeeId === cleanEmployeeId) {
        throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", `Employee ID '${cleanEmployeeId}' is already in use. Please use a unique Employee ID.`);
      }
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);

    try {
      const user = await UserModel.create({
        username: cleanUsername,
        name: input.name.trim(),
        email: cleanEmail,
        employeeId: cleanEmployeeId,
        phone: input.phone?.trim() || "",
        role: "HR",
        active: true,
        passwordHash,
        currentPassword: rawPassword,
        mustChangePassword: false,
      });
      await ActivityLogModel.create({
        candidateId: "",
        candidateName: user.name,
        type: "HR_ACCOUNT_CREATED",
        message: `HR account created for ${user.email} with password`,
        performedBy: actor.name,
        performedByUserId: actor.id,
      });
      return {
        ...publicEmployee(user),
        currentPassword: rawPassword,
      };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000) {
        const keyPattern = (error as { keyPattern?: Record<string, number> }).keyPattern || {};
        const field = Object.keys(keyPattern)[0];
        if (field === "username") throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", "Username is already taken. Please choose another username.");
        if (field === "email") throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", "Email is already registered. Please use another email.");
        if (field === "employeeId") throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", "Employee ID is already in use. Please use a unique Employee ID.");
        throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", "Username, email, or employee ID is already in use.");
      }
      throw error;
    }
  }

  async update(id: string, changes: Partial<Pick<UserRecord, "name" | "email" | "employeeId" | "phone">> & { password?: string }, actor: AuthenticatedAccount) {
    const user = await UserModel.findOne(hrQuery(id));
    if (!user) throw new HttpError(404, "HR_NOT_FOUND", "HR account not found.");

    if (changes.email || changes.employeeId) {
      const conflictFilter: FilterQuery<UserRecord>[] = [];
      if (changes.email && changes.email.trim().toLowerCase() !== user.email) {
        conflictFilter.push({ email: changes.email.trim().toLowerCase() });
      }
      if (changes.employeeId && changes.employeeId.trim().toUpperCase() !== user.employeeId) {
        conflictFilter.push({ employeeId: changes.employeeId.trim().toUpperCase() });
      }
      if (conflictFilter.length > 0) {
        const existing = await UserModel.findOne({
          _id: { $ne: user._id },
          $or: conflictFilter,
        }).lean();
        if (existing) {
          if (changes.email && existing.email === changes.email.trim().toLowerCase()) {
            throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", `Email '${changes.email}' is already in use by another account.`);
          }
          if (changes.employeeId && existing.employeeId === changes.employeeId.trim().toUpperCase()) {
            throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", `Employee ID '${changes.employeeId}' is already in use.`);
          }
        }
      }
    }

    if (changes.name !== undefined) user.name = changes.name.trim();
    if (changes.phone !== undefined) user.phone = changes.phone.trim();
    if (changes.email !== undefined) user.email = changes.email.trim().toLowerCase();
    if (changes.employeeId !== undefined) user.employeeId = changes.employeeId.trim().toUpperCase();

    const trimmedPassword = changes.password?.trim();
    if (trimmedPassword) {
      user.passwordHash = await bcrypt.hash(trimmedPassword, 12);
      user.currentPassword = trimmedPassword;
      user.mustChangePassword = false;
      user.invitationTokenHash = undefined;
      user.invitationExpiresAt = undefined;
    }

    try {
      await user.save();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000) {
        throw new HttpError(409, "HR_ACCOUNT_DUPLICATE", "Email or employee ID is already in use.");
      }
      throw error;
    }
    await ActivityLogModel.create({
      candidateId: "",
      candidateName: user.name,
      type: "HR_ACCOUNT_UPDATED",
      message: trimmedPassword
        ? `HR profile and password updated for ${user.email}`
        : `HR profile updated for ${user.email}`,
      performedBy: actor.name,
      performedByUserId: actor.id,
    });
    return publicEmployee(user);
  }

  async setActive(id: string, active: boolean, actor: AuthenticatedAccount) {
    const user = await UserModel.findOneAndUpdate(hrQuery(id), { $set: { active } }, { new: true });
    if (!user) throw new HttpError(404, "HR_NOT_FOUND", "HR account not found.");
    await ActivityLogModel.create({ candidateId: "", candidateName: user.name, type: active ? "HR_ACCOUNT_ACTIVATED" : "HR_ACCOUNT_DEACTIVATED", message: `HR account ${active ? "activated" : "deactivated"}: ${user.email}`, performedBy: actor.name, performedByUserId: actor.id });
    return publicEmployee(user);
  }

  async assignedCandidates(id: string, actor: AuthenticatedAccount, page = 1, pageSize = 50) {
    const hr = await UserModel.findOne(hrQuery(id)).lean();
    if (!hr) throw new HttpError(404, "HR_NOT_FOUND", "HR account not found.");
    const filter: FilterQuery<CandidateRecord> = { assignedToId: hr.employeeId };
    const [items, total] = await Promise.all([
      CandidateModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      CandidateModel.countDocuments(filter),
    ]);
    if (actor.role === "HR" && actor.employeeId !== hr.employeeId) throw new HttpError(403, "FORBIDDEN", "You cannot view another HR employee's assignments.");
    return { items: items.map((candidate) => candidate.toJSON()), pagination: paginationResult(total, page, pageSize) };
  }

  async performance(id: string) {
    const hr = await UserModel.findOne(hrQuery(id)).lean();
    if (!hr) throw new HttpError(404, "HR_NOT_FOUND", "HR account not found.");
    const [total, counts] = await Promise.all([
      CandidateModel.countDocuments({ assignedToId: hr.employeeId, status: { $ne: "ARCHIVED" } }),
      CandidateModel.aggregate([
        { $match: { assignedToId: hr.employeeId, status: { $ne: "ARCHIVED" } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);
    return { employee: publicEmployee(hr), totalAssigned: total, byStatus: Object.fromEntries(counts.map((entry) => [String(entry._id), entry.count])) };
  }

  async delete(id: string, actor: AuthenticatedAccount) {
    if (actor.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can delete HR accounts.");
    const user = await UserModel.findOne(hrQuery(id));
    if (!user) throw new HttpError(404, "HR_NOT_FOUND", "HR account not found.");

    const assignedCandidates = await CandidateModel.find({ assignedToId: user.employeeId });
    if (assignedCandidates.length > 0) {
      await CandidateModel.updateMany(
        { assignedToId: user.employeeId },
        { $set: { assignedToId: null, assignedToName: null } }
      );
      for (const candidate of assignedCandidates) {
        await ActivityLogModel.create({
          candidateId: candidate.id,
          candidateName: candidate.name,
          type: "UNASSIGNED",
          message: `Unassigned because HR account ${user.name} (${user.employeeId}) was deleted`,
          performedBy: actor.name,
          performedByUserId: actor.id,
        });
      }
    }

    await user.deleteOne();

    await ActivityLogModel.create({
      candidateId: "",
      candidateName: user.name,
      type: "HR_ACCOUNT_DELETED",
      message: `HR account deleted: ${user.name} (${user.email}, ${user.employeeId}). ${assignedCandidates.length} candidate(s) unassigned.`,
      performedBy: actor.name,
      performedByUserId: actor.id,
    });

    return {
      success: true,
      deletedId: user.employeeId,
      unassignedCandidatesCount: assignedCandidates.length,
    };
  }
}

export const employeeService = new EmployeeService();