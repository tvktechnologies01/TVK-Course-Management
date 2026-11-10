import { ActivityLogModel } from "../models/activity-log.model";
import { AssignmentHistoryModel, AssignmentHistoryRecord } from "../models/assignment-history.model";
import { CandidateDocument, CandidateModel } from "../models/candidate.model";
import { UserModel, AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { randomUUID } from "node:crypto";

export interface HrWorkloadStats {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  currentlyAssignedCount: number;
  previouslyHandledCount: number;
  pendingCount: number;
  screeningCount: number;
  interviewCount: number;
  completedCount: number;
  overdueCount: number;
  lastActivityDate: Date | null;
}

export interface WorkloadOverview {
  summary: {
    totalActiveCandidates: number;
    unassignedCandidates: number;
    currentlyAssignedCandidates: number;
    pendingCandidates: number;
    overdueCandidates: number;
    completedCandidates: number;
  };
  hrMembers: HrWorkloadStats[];
}

export class WorkloadService {
  async getOverview(): Promise<WorkloadOverview> {
    const now = new Date();
    const activeCandidatesFilter = { status: { $ne: "ARCHIVED" } };

    // Fetch active candidates and HR users
    const [allActiveCandidates, activeHrs] = await Promise.all([
      CandidateModel.find(activeCandidatesFilter).lean(),
      UserModel.find({ role: "HR", active: true }).sort({ name: 1 }).lean(),
    ]);

    const totalActiveCandidates = allActiveCandidates.length;
    let unassignedCandidates = 0;
    let currentlyAssignedCandidates = 0;
    let pendingCandidates = 0;
    let overdueCandidates = 0;
    let completedCandidates = 0;

    for (const c of allActiveCandidates) {
      if (!c.assignedToId) {
        unassignedCandidates++;
      } else {
        currentlyAssignedCandidates++;
      }

      if (["NEW", "ASSIGNED", "CONTACT_PENDING"].includes(c.status)) {
        pendingCandidates++;
      }

      const isCompleted = ["SELECTED", "REJECTED"].includes(c.status) || Boolean(c.courseCompleted);
      if (isCompleted) {
        completedCandidates++;
      } else {
        const isOverdue = (c.nextFollowUpAt && new Date(c.nextFollowUpAt) < now);
        if (isOverdue) overdueCandidates++;
      }
    }

    // HR members stats
    const hrMembers: HrWorkloadStats[] = [];

    for (const hr of activeHrs) {
      const assignedToThisHr = allActiveCandidates.filter(
        (c) => c.assignedToId === hr.employeeId
      );

      let pending = 0;
      let screening = 0;
      let interview = 0;
      let completed = 0;
      let overdue = 0;

      for (const c of assignedToThisHr) {
        if (["NEW", "ASSIGNED", "CONTACT_PENDING"].includes(c.status)) {
          pending++;
        } else if (["CALLED", "CALL_BACK", "INTERESTED"].includes(c.status)) {
          screening++;
        } else if (["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(c.status)) {
          interview++;
        }

        const isDone = ["SELECTED", "REJECTED"].includes(c.status) || Boolean(c.courseCompleted);
        if (isDone) {
          completed++;
        } else if (c.nextFollowUpAt && new Date(c.nextFollowUpAt) < now) {
          overdue++;
        }
      }

      // Previously handled count: candidates previously assigned to this HR but currently assigned to someone else or unassigned
      const [previousHistories, lastLog] = await Promise.all([
        AssignmentHistoryModel.distinct("candidateId", {
          previousAssigneeId: hr.employeeId,
          assignedToId: { $ne: hr.employeeId },
        }),
        ActivityLogModel.findOne({
          $or: [{ performedByUserId: hr._id.toString() }, { performedBy: hr.name }],
        }).sort({ createdAt: -1 }).lean(),
      ]);

      hrMembers.push({
        employeeId: hr.employeeId,
        name: hr.name,
        email: hr.email,
        phone: hr.phone || "",
        role: hr.role,
        active: hr.active,
        currentlyAssignedCount: assignedToThisHr.length,
        previouslyHandledCount: previousHistories.length,
        pendingCount: pending,
        screeningCount: screening,
        interviewCount: interview,
        completedCount: completed,
        overdueCount: overdue,
        lastActivityDate: lastLog ? (lastLog as any).createdAt : null,
      });
    }

    return {
      summary: {
        totalActiveCandidates,
        unassignedCandidates,
        currentlyAssignedCandidates,
        pendingCandidates,
        overdueCandidates,
        completedCandidates,
      },
      hrMembers,
    };
  }

  async getHrDetails(employeeId: string): Promise<Record<string, unknown>> {
    const hr = await UserModel.findOne({ employeeId, role: "HR" }).lean();
    if (!hr) throw new HttpError(404, "HR_NOT_FOUND", "HR member not found.");

    const [currentCandidates, previousCandidateIds, historyRecords] = await Promise.all([
      CandidateModel.find({ assignedToId: employeeId, status: { $ne: "ARCHIVED" } })
        .sort({ updatedAt: -1 })
        .lean(),
      AssignmentHistoryModel.distinct("candidateId", {
        previousAssigneeId: employeeId,
        assignedToId: { $ne: employeeId },
      }),
      AssignmentHistoryModel.find({
        $or: [{ assignedToId: employeeId }, { previousAssigneeId: employeeId }],
      })
        .sort({ assignedAt: -1 })
        .limit(30)
        .lean(),
    ]);

    const previousCandidates = previousCandidateIds.length > 0
      ? await CandidateModel.find({
          _id: { $in: previousCandidateIds },
          assignedToId: { $ne: employeeId },
          status: { $ne: "ARCHIVED" },
        }).lean()
      : [];

    return {
      hr: {
        employeeId: hr.employeeId,
        name: hr.name,
        email: hr.email,
        phone: hr.phone || "",
        active: hr.active,
      },
      currentCandidates,
      previousCandidates,
      historyRecords,
    };
  }

  async getCandidates(params: {
    search?: string;
    hrId?: string;
    stage?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));
    const filter: Record<string, unknown> = { status: { $ne: "ARCHIVED" } };

    if (params.hrId) {
      if (params.hrId === "unassigned") {
        filter.assignedToId = null;
      } else if (params.hrId === "assigned") {
        filter.assignedToId = { $ne: null };
      } else if (params.hrId !== "all") {
        filter.assignedToId = params.hrId;
      }
    }

    if (params.stage && params.stage !== "all") {
      if (params.stage === "pending") {
        filter.status = { $in: ["NEW", "ASSIGNED", "CONTACT_PENDING"] };
      } else if (params.stage === "screening") {
        filter.status = { $in: ["CALLED", "CALL_BACK", "INTERESTED"] };
      } else if (params.stage === "interview") {
        filter.status = { $in: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] };
      } else if (params.stage === "completed") {
        filter.status = { $in: ["SELECTED", "REJECTED"] };
      } else {
        filter.status = params.stage;
      }
    }

    if (params.search) {
      const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { position: regex },
        { _id: regex },
      ];
    }

    const [items, total] = await Promise.all([
      CandidateModel.find(filter)
        .sort({ updatedAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      CandidateModel.countDocuments(filter),
    ]);

    return {
      items: items.map((c) => (typeof c.toJSON === "function" ? c.toJSON() : { id: (c as any)._id?.toString(), ...c })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async assignCandidates(
    candidateIds: string[],
    employeeId: string,
    reason: string | undefined,
    actor: AuthenticatedAccount,
  ) {
    if (actor.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Administrators / Managers can assign or reassign candidates.");
    }
    if (!candidateIds.length) {
      throw new HttpError(400, "BAD_REQUEST", "No candidate IDs provided.");
    }

    const targetHr = await UserModel.findOne({ employeeId, role: "HR", active: true });
    if (!targetHr) {
      throw new HttpError(422, "HR_NOT_FOUND", "Selected HR member does not exist or is inactive.");
    }

    const updatedCandidates: Record<string, unknown>[] = [];
    const now = new Date();

    for (const id of candidateIds) {
      const candidate = await CandidateModel.findById(id);
      if (!candidate) continue;
      if (candidate.status === "ARCHIVED") continue;

      const previousAssigneeId = candidate.assignedToId;
      const previousAssigneeName = candidate.assignedToName;
      const isReassignment = Boolean(previousAssigneeId && previousAssigneeId !== targetHr.employeeId);
      const action = isReassignment ? "REASSIGNED" : "ASSIGNED";

      // Update candidate ownership
      candidate.assignedToId = targetHr.employeeId;
      candidate.assignedToName = targetHr.name;

      // Only transition NEW to ASSIGNED; keep existing recruitment stage untouched during reassignment
      if (candidate.status === "NEW") {
        candidate.status = "ASSIGNED";
      }

      await candidate.save();

      // Record assignment history
      await AssignmentHistoryModel.create({
        candidateId: candidate.id,
        candidateName: candidate.name,
        previousAssigneeId: previousAssigneeId || null,
        previousAssigneeName: previousAssigneeName || null,
        assignedToId: targetHr.employeeId,
        assignedToName: targetHr.name,
        assignedByUserId: actor.id,
        assignedByName: actor.name,
        assignedAt: now,
        action,
        reason: reason?.trim() || "",
      });

      // Record activity feed
      const messageText = isReassignment
        ? `Reassigned candidate from ${previousAssigneeName || "Unknown"} to ${targetHr.name}${reason ? ` (Reason: ${reason})` : ""}`
        : `Assigned candidate to ${targetHr.name}${reason ? ` (Reason: ${reason})` : ""}`;

      await ActivityLogModel.create({
        _id: randomUUID(),
        candidateId: candidate.id,
        candidateName: candidate.name,
        type: action,
        message: messageText,
        performedBy: actor.name,
        performedByUserId: actor.id,
      });

      updatedCandidates.push(candidate.toJSON());
    }

    return updatedCandidates;
  }

  async getAssignmentHistory(candidateId?: string, limit = 50) {
    const filter = candidateId ? { candidateId } : {};
    const records = await AssignmentHistoryModel.find(filter)
      .sort({ assignedAt: -1 })
      .limit(limit)
      .lean();
    return records;
  }

  async getActivityFeed(limit = 60) {
    const activities = await ActivityLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return activities;
  }
}

export const workloadService = new WorkloadService();
