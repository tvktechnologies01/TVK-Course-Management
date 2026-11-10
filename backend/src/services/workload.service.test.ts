import { describe, expect, it, vi, beforeEach } from "vitest";
import { workloadService } from "./workload.service";
import { CandidateModel } from "../models/candidate.model";
import { UserModel } from "../models/user.model";
import { AssignmentHistoryModel } from "../models/assignment-history.model";
import { ActivityLogModel } from "../models/activity-log.model";

describe("HR Workload Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockActor = {
    id: "user-admin",
    username: "admin",
    name: "Admin User",
    email: "admin@tvk.com",
    employeeId: "EMP-ADM-01",
    role: "MANAGER" as const,
    active: true,
    mustChangePassword: false,
  };

  it("calculates workload overview summary and per-HR counts accurately", async () => {
    const mockCandidates = [
      { _id: "c1", name: "Candidate 1", status: "NEW", assignedToId: null },
      { _id: "c2", name: "Candidate 2", status: "INTERVIEW_SCHEDULED", assignedToId: "HR01" },
      { _id: "c3", name: "Candidate 3", status: "SELECTED", assignedToId: "HR01", courseCompleted: true },
      { _id: "c4", name: "Candidate 4", status: "CALLED", assignedToId: "HR02", nextFollowUpAt: new Date(2020, 0, 1) },
    ];

    const mockHrs = [
      { _id: "hr-id-1", employeeId: "HR01", name: "Alice HR", email: "alice@tvk.com", role: "HR", active: true },
      { _id: "hr-id-2", employeeId: "HR02", name: "Bob HR", email: "bob@tvk.com", role: "HR", active: true },
    ];

    vi.spyOn(CandidateModel, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockCandidates),
    } as any);

    vi.spyOn(UserModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockHrs),
      }),
    } as any);

    vi.spyOn(AssignmentHistoryModel, "distinct").mockResolvedValue(["c9"]);
    vi.spyOn(ActivityLogModel, "findOne").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ createdAt: new Date("2026-10-30T10:00:00Z") }),
      }),
    } as any);

    const result = await workloadService.getOverview();

    expect(result.summary.totalActiveCandidates).toBe(4);
    expect(result.summary.unassignedCandidates).toBe(1);
    expect(result.summary.currentlyAssignedCandidates).toBe(3);
    expect(result.summary.completedCandidates).toBe(1);
    expect(result.summary.overdueCandidates).toBe(1);

    expect(result.hrMembers.length).toBe(2);
    expect(result.hrMembers[0].employeeId).toBe("HR01");
    expect(result.hrMembers[0].currentlyAssignedCount).toBe(2);
    expect(result.hrMembers[0].interviewCount).toBe(1);
    expect(result.hrMembers[0].completedCount).toBe(1);
    expect(result.hrMembers[0].previouslyHandledCount).toBe(1);
  });

  it("assigns candidate, creates history and activity log without changing existing advanced stage", async () => {
    const mockCandidate: any = {
      id: "c-interview",
      _id: "c-interview",
      name: "John Doe",
      status: "INTERVIEW_SCHEDULED",
      assignedToId: "HR01",
      assignedToName: "Alice HR",
      save: vi.fn().mockResolvedValue(true),
      toJSON: () => ({ id: "c-interview", name: "John Doe", status: "INTERVIEW_SCHEDULED" }),
    };

    vi.spyOn(UserModel, "findOne").mockResolvedValue({
      employeeId: "HR02",
      name: "Bob HR",
      role: "HR",
      active: true,
    } as any);

    vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockCandidate);
    const historySpy = vi.spyOn(AssignmentHistoryModel, "create").mockResolvedValue({} as any);
    const activitySpy = vi.spyOn(ActivityLogModel, "create").mockResolvedValue({} as any);

    const res = await workloadService.assignCandidates(
      ["c-interview"],
      "HR02",
      "Workload rebalance",
      mockActor,
    );

    expect(mockCandidate.assignedToId).toBe("HR02");
    expect(mockCandidate.assignedToName).toBe("Bob HR");
    // CRITICAL: Stage INTERVIEW_SCHEDULED preserved (not reverted to ASSIGNED)
    expect(mockCandidate.status).toBe("INTERVIEW_SCHEDULED");

    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: "c-interview",
        previousAssigneeId: "HR01",
        previousAssigneeName: "Alice HR",
        assignedToId: "HR02",
        assignedToName: "Bob HR",
        action: "REASSIGNED",
        reason: "Workload rebalance",
      }),
    );

    expect(activitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "REASSIGNED",
        performedBy: "Admin User",
      }),
    );
  });

  it("transitions NEW candidate to ASSIGNED on first assignment", async () => {
    const mockCandidate: any = {
      id: "c-new",
      _id: "c-new",
      name: "New Candidate",
      status: "NEW",
      assignedToId: null,
      assignedToName: null,
      save: vi.fn().mockResolvedValue(true),
      toJSON: () => ({ id: "c-new", name: "New Candidate", status: "ASSIGNED" }),
    };

    vi.spyOn(UserModel, "findOne").mockResolvedValue({
      employeeId: "HR01",
      name: "Alice HR",
      role: "HR",
      active: true,
    } as any);

    vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockCandidate);
    vi.spyOn(AssignmentHistoryModel, "create").mockResolvedValue({} as any);
    vi.spyOn(ActivityLogModel, "create").mockResolvedValue({} as any);

    await workloadService.assignCandidates(["c-new"], "HR01", undefined, mockActor);

    expect(mockCandidate.status).toBe("ASSIGNED");
    expect(mockCandidate.assignedToId).toBe("HR01");
  });

  it("throws forbidden if non-manager attempts assignment", async () => {
    const hrActor = { ...mockActor, role: "HR" as const };
    await expect(
      workloadService.assignCandidates(["c1"], "HR01", undefined, hrActor),
    ).rejects.toThrow("Only Administrators / Managers can assign or reassign candidates.");
  });
});
