import { randomUUID } from "node:crypto";
import { ActivityLogModel, ActivityLogRecord } from "../models/activity-log.model";
import { FilterQuery } from "mongoose";
import { AuthenticatedAccount } from "../models/user.model";
import { paginationResult } from "../validators/common.validators";
import { z } from "zod";

export const activityLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(200).optional(),
  candidateId: z.string().trim().max(120).optional(),
  type: z.string().trim().max(80).optional(),
  performedByUserId: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict();

export class ActivityLogService {
  async list(rawQuery: unknown) {
    const query = activityLogQuerySchema.parse(rawQuery);
    const filter: FilterQuery<ActivityLogRecord> = {};
    if (query.candidateId) filter.candidateId = query.candidateId;
    if (query.type) filter.type = query.type;
    if (query.performedByUserId) filter.performedByUserId = query.performedByUserId;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }
    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { candidateName: expression },
        { type: expression },
        { message: expression },
        { performedBy: expression },
      ];
    }
    const [items, total] = await Promise.all([
      ActivityLogModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.pageSize).limit(query.pageSize),
      ActivityLogModel.countDocuments(filter),
    ]);
    return { items: items.map((item) => item.toJSON()), pagination: paginationResult(total, query.page, query.pageSize) };
  }

  async record(
    candidateId: string,
    candidateName: string,
    type: string,
    message: string,
    actor: AuthenticatedAccount,
  ): Promise<void> {
    await ActivityLogModel.create({
      _id: randomUUID(),
      candidateId,
      candidateName,
      type,
      message,
      performedBy: actor.name,
      performedByUserId: actor.id,
    } satisfies ActivityLogRecord);
  }
}

export const activityLogService = new ActivityLogService();
