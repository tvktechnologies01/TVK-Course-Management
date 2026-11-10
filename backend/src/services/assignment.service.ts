import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { ActivityLogModel } from "../models/activity-log.model";
import { AssignmentHistoryModel, AssignmentHistoryRecord } from "../models/assignment-history.model";
import { CandidateDocument, CandidateModel } from "../models/candidate.model";
import { UserModel } from "../models/user.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { paginationResult } from "../validators/common.validators";

export class AssignmentService {
  async list(page: number, pageSize: number, employeeId?: string) {
    const filter = { assignedToId: { $ne: null }, ...(employeeId ? { assignedToId: employeeId } : {}) };
    const [items, total] = await Promise.all([
      CandidateModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      CandidateModel.countDocuments(filter),
    ]);
    return { items: items.map((candidate) => candidate.toJSON()), pagination: paginationResult(total, page, pageSize) };
  }

  async assign(candidateIds: string[], employeeId: string, actor: AuthenticatedAccount) {
    if (actor.role !== "MANAGER" && actor.role !== "HR") throw new HttpError(403, "FORBIDDEN", "Only Managers and HR can assign candidates.");
    const employee = await UserModel.findOne({ employeeId, role: "HR", active: true });
    if (!employee) throw new HttpError(422, "HR_INACTIVE_OR_MISSING", "Select an active HR account.");

    const assigned: Record<string, unknown>[] = [];
    for (const candidateId of candidateIds) {
      const candidate = await CandidateModel.findById(candidateId);
      if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", `Candidate ${candidateId} was not found.`);
      if (candidate.status === "ARCHIVED") throw new HttpError(422, "CANDIDATE_ARCHIVED", "Archived candidates cannot be assigned.");
      await this.assignOne(candidate, employee.employeeId, employee.name, actor);
      assigned.push(candidate.toJSON());
    }
    return assigned;
  }

  private async assignOne(candidate: CandidateDocument, employeeId: string, employeeName: string, actor: AuthenticatedAccount): Promise<void> {
    const previousAssigneeId = candidate.assignedToId;
    const previousAssigneeName = candidate.assignedToName;
    const previousStatus = candidate.status;
    const assignedAt = new Date();
    const history: AssignmentHistoryRecord = {
      candidateId: candidate.id,
      candidateName: candidate.name,
      previousAssigneeId,
      previousAssigneeName,
      assignedToId: employeeId,
      assignedToName: employeeName,
      assignedByUserId: actor.id,
      assignedByName: actor.name,
      assignedAt,
    };

    candidate.assignedToId = employeeId;
    candidate.assignedToName = employeeName;
    if (candidate.status === "NEW") candidate.status = "ASSIGNED";

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await candidate.save({ session });
        await AssignmentHistoryModel.create([history], { session });
        await ActivityLogModel.create([{
          candidateId: candidate.id,
          _id: randomUUID(),
          candidateName: candidate.name,
          type: previousAssigneeId ? "REASSIGNED" : "ASSIGNED",
          message: previousAssigneeId
            ? `Reassigned from ${previousAssigneeName} to ${employeeName}`
            : `Assigned to ${employeeName}`,
          performedBy: actor.name,
          performedByUserId: actor.id,
        }], { session });
      });
    } catch (error: unknown) {
      if (!this.isStandaloneTransactionError(error)) throw error;
      await this.assignWithoutTransaction(candidate, history, previousStatus, actor);
    } finally {
      await session.endSession();
    }
  }

  private async assignWithoutTransaction(
    candidate: CandidateDocument,
    history: AssignmentHistoryRecord,
    previousStatus: CandidateDocument["status"],
    actor: AuthenticatedAccount,
  ): Promise<void> {
    let historyId = "";
    let activityId = "";
    try {
      await candidate.save();
      const historyRecord = await AssignmentHistoryModel.create(history);
      historyId = historyRecord.id;
      const activityRecord = await ActivityLogModel.create({
        candidateId: candidate.id,
        _id: randomUUID(),
        candidateName: candidate.name,
        type: history.previousAssigneeId ? "REASSIGNED" : "ASSIGNED",
        message: history.previousAssigneeId
          ? `Reassigned from ${history.previousAssigneeName} to ${history.assignedToName}`
          : `Assigned to ${history.assignedToName}`,
        performedBy: actor.name,
        performedByUserId: actor.id,
      });
      activityId = activityRecord.id;
    } catch (error: unknown) {
      candidate.assignedToId = history.previousAssigneeId;
      candidate.assignedToName = history.previousAssigneeName;
      candidate.status = previousStatus;
      await candidate.save();
      if (historyId) await AssignmentHistoryModel.deleteOne({ _id: historyId });
      if (activityId) await ActivityLogModel.deleteOne({ _id: activityId });
      throw error;
    }
  }

  private isStandaloneTransactionError(error: unknown): boolean {
    return error instanceof Error && /Transaction numbers are only allowed|replica set|mongos/i.test(error.message);
  }
}

export const assignmentService = new AssignmentService();
