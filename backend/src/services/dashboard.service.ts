import { ActivityLogModel } from "../models/activity-log.model";
import { CandidateModel, CandidateStatus } from "../models/candidate.model";
import { FollowUpModel } from "../models/follow-up.model";
import { UserModel } from "../models/user.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";

const contactStatuses: CandidateStatus[] = [
  "CALLED", "INTERESTED", "NOT_INTERESTED", "NO_RESPONSE", "CALL_BACK",
  "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "SELECTED", "REJECTED",
];

export class DashboardService {
  async summary(actor: AuthenticatedAccount) {
    if (actor.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can view dashboard summaries.");
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [candidateStats, dueToday, overdue, upcoming, employees, callCounts, recentCandidates, selectedCandidates] = await Promise.all([
      CandidateModel.aggregate([
        { $facet: {
          all: [{ $count: "total" }],
          active: [{ $match: { status: { $ne: "ARCHIVED" } } }, { $count: "count" }],
          unassigned: [{ $match: { status: { $ne: "ARCHIVED" }, assignedToId: null } }, { $count: "count" }],
          sources: [{ $match: { status: { $ne: "ARCHIVED" } } }, { $group: { _id: "$source", count: { $sum: 1 } } }],
          statuses: [{ $match: { status: { $ne: "ARCHIVED" } } }, { $group: { _id: "$status", count: { $sum: 1 } } }],
          hr: [
            { $match: { status: { $ne: "ARCHIVED" }, assignedToId: { $ne: null } } },
            { $group: { _id: { employeeId: "$assignedToId", status: "$status" }, count: { $sum: 1 } } },
          ],
          archived: [{ $match: { status: "ARCHIVED" } }, { $count: "total" }],
        } },
      ]),
      FollowUpModel.countDocuments({ completed: false, scheduledAt: { $gte: todayStart, $lt: tomorrowStart } }),
      FollowUpModel.countDocuments({ completed: false, scheduledAt: { $lt: todayStart } }),
      FollowUpModel.countDocuments({ completed: false, scheduledAt: { $lt: nextWeek } }),
      UserModel.find({ role: "HR", active: true }).select("name employeeId email active").sort({ name: 1 }).lean(),
      ActivityLogModel.aggregate([
        { $match: { type: "CALL" } },
        { $group: { _id: "$performedByUserId", calls: { $sum: 1 } } },
      ]),
      CandidateModel.find({ status: { $ne: "ARCHIVED" } }).sort({ createdAt: -1 }).limit(5),
      CandidateModel.find({ status: "SELECTED" }).sort({ updatedAt: -1 }).limit(5),
    ]);

    const root = candidateStats[0] ?? {};
    const activeTotal = root["active"]?.[0]?.["count"] ?? 0;
    const statusCounts = Object.fromEntries((root["statuses"] ?? []).map((item: { _id: string; count: number }) => [item._id, item.count])) as Record<string, number>;
    const sourceCounts = Object.fromEntries((root["sources"] ?? []).map((item: { _id: string; count: number }) => [item._id, item.count])) as Record<string, number>;
    const hrCounts = new Map<string, Record<string, number>>();
    for (const item of root["hr"] ?? []) {
      const employeeId = String(item["_id"]["employeeId"]);
      const counts = hrCounts.get(employeeId) ?? {};
      counts[String(item["_id"]["status"])] = item["count"];
      hrCounts.set(employeeId, counts);
    }
    const callsByUser = new Map<string, number>(callCounts.map((item: { _id: string; calls: number }) => [item._id, item.calls]));

    return {
      totalCandidates: root["all"]?.[0]?.["total"] ?? 0,
      activeCandidates: activeTotal,
      archivedCandidates: root["archived"]?.[0]?.["total"] ?? 0,
      unassignedCandidates: root["unassigned"]?.[0]?.["count"] ?? 0,
      sourceCounts,
      statusCounts,
      followUpsDueToday: dueToday,
      overdueFollowUps: overdue,
      followUpsDueWithinWeek: upcoming,
      contactedCandidates: contactStatuses.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0),
      recentCandidates: recentCandidates.map((candidate) => candidate.toJSON()),
      selectedCandidates: selectedCandidates.map((candidate) => candidate.toJSON()),
      hrPerformance: employees.map((employee) => {
        const counts = hrCounts.get(employee.employeeId) ?? {};
        const totalAssigned = Object.values(counts).reduce((sum, count) => sum + count, 0);
        return {
          employeeId: employee.employeeId,
          name: employee.name,
          email: employee.email,
          totalAssigned,
          calls: callsByUser.get(String(employee._id)) ?? 0,
          contacted: contactStatuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0),
          interested: counts["INTERESTED"] ?? 0,
          noResponse: counts["NO_RESPONSE"] ?? 0,
          interviewsScheduled: counts["INTERVIEW_SCHEDULED"] ?? 0,
          interviewsCompleted: counts["INTERVIEW_COMPLETED"] ?? 0,
          selected: counts["SELECTED"] ?? 0,
          rejected: counts["REJECTED"] ?? 0,
        };
      }),
    };
  }
}

export const dashboardService = new DashboardService();
