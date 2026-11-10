import { FilterQuery } from "mongoose";
import { randomUUID } from "node:crypto";
import { ActivityLogModel } from "../models/activity-log.model";
import { CandidateModel } from "../models/candidate.model";
import { FollowUpModel, FollowUpRecord } from "../models/follow-up.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { paginationResult } from "../validators/common.validators";
import { followUpListQuerySchema } from "../validators/follow-up.validators";

export class FollowUpService {
  async list(rawQuery: unknown, actor: AuthenticatedAccount) {
    const query = followUpListQuerySchema.parse(rawQuery);
    const filter: FilterQuery<FollowUpRecord> = {};
    if (query.completed) filter.completed = query.completed === "true";
    if (query.candidateId) filter.candidateId = query.candidateId;
    if (query.from || query.to) {
      filter.scheduledAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }
    if (actor.role === "HR") {
      const candidateIds = await CandidateModel.find({ assignedToId: actor.employeeId }).distinct("_id");
      filter.candidateId = { $in: candidateIds.map(String) };
    }
    const direction = query.sort === "asc" ? 1 : -1;
    const [items, total] = await Promise.all([
      FollowUpModel.find(filter).sort({ scheduledAt: direction }).skip((query.page - 1) * query.pageSize).limit(query.pageSize),
      FollowUpModel.countDocuments(filter),
    ]);
    return { items: items.map((item) => item.toJSON()), pagination: paginationResult(total, query.page, query.pageSize) };
  }

  async create(input: { candidateId: string; scheduledAt: Date; notes: string }, actor: AuthenticatedAccount) {
    const candidate = await CandidateModel.findById(input.candidateId);
    if (!candidate || (actor.role === "HR" && candidate.assignedToId !== actor.employeeId)) {
      throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
    }
    const followUp = await FollowUpModel.create({
      _id: randomUUID(),
      ...input,
      candidateName: candidate.name,
      completed: false,
      createdBy: actor.name,
      createdByUserId: actor.id,
    });
    candidate.nextFollowUpAt = input.scheduledAt;
    await candidate.save();
    await ActivityLogModel.create({
      candidateId: candidate.id,
      candidateName: candidate.name,
      type: "FOLLOW_UP_CREATED",
      message: `Follow-up scheduled for ${input.scheduledAt.toISOString()}`,
      performedBy: actor.name,
      performedByUserId: actor.id,
    });
    return followUp.toJSON();
  }

  async update(id: string, changes: Partial<Pick<FollowUpRecord, "scheduledAt" | "notes" | "completed">>, actor: AuthenticatedAccount) {
    const followUp = await FollowUpModel.findById(id);
    if (!followUp) throw new HttpError(404, "FOLLOW_UP_NOT_FOUND", "Follow-up not found.");
    await this.assertAccessible(followUp, actor);
    Object.assign(followUp, changes);
    await followUp.save();
    await this.syncCandidateDate(followUp.candidateId);
    await ActivityLogModel.create({
      candidateId: followUp.candidateId,
      candidateName: followUp.candidateName,
      type: followUp.completed ? "FOLLOW_UP_COMPLETED" : "FOLLOW_UP_UPDATED",
      message: followUp.completed ? "Follow-up completed" : "Follow-up updated",
      performedBy: actor.name,
      performedByUserId: actor.id,
    });
    return followUp.toJSON();
  }

  async remove(id: string, actor: AuthenticatedAccount): Promise<void> {
    const followUp = await FollowUpModel.findById(id);
    if (!followUp) throw new HttpError(404, "FOLLOW_UP_NOT_FOUND", "Follow-up not found.");
    await this.assertAccessible(followUp, actor);
    if (actor.role !== "MANAGER" && followUp.createdByUserId !== actor.id) {
      throw new HttpError(403, "FORBIDDEN", "You can only remove follow-ups you created.");
    }
    await followUp.deleteOne();
    await this.syncCandidateDate(followUp.candidateId);
  }

  private async assertAccessible(followUp: FollowUpRecord, actor: AuthenticatedAccount): Promise<void> {
    if (actor.role !== "HR") return;
    const assigned = await CandidateModel.exists({ _id: followUp.candidateId, assignedToId: actor.employeeId });
    if (!assigned) throw new HttpError(404, "FOLLOW_UP_NOT_FOUND", "Follow-up not found.");
  }

  private async syncCandidateDate(candidateId: string): Promise<void> {
    const next = await FollowUpModel.findOne({ candidateId, completed: false }).sort({ scheduledAt: 1 });
    await CandidateModel.updateOne({ _id: candidateId }, { $set: { nextFollowUpAt: next?.scheduledAt ?? null } });
  }
}

export const followUpService = new FollowUpService();