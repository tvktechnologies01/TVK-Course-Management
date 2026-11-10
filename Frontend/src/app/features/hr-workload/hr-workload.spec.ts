import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { of } from "rxjs";
import { HrWorkloadComponent } from "./hr-workload";

describe("HrWorkloadComponent", () => {
  let component: HrWorkloadComponent;
  let workloadServiceMock: any;
  let candidateServiceMock: any;
  let employeeServiceMock: any;
  let cdrMock: any;

  const mockOverview = {
    summary: {
      totalActiveCandidates: 10,
      unassignedCandidates: 3,
      currentlyAssignedCandidates: 7,
      pendingCandidates: 4,
      overdueCandidates: 1,
      completedCandidates: 2,
    },
    hrMembers: [
      {
        employeeId: "HR01",
        name: "Alice HR",
        email: "alice@tvk.com",
        phone: "9876543210",
        role: "HR",
        active: true,
        currentlyAssignedCount: 4,
        previouslyHandledCount: 2,
        pendingCount: 2,
        screeningCount: 1,
        interviewCount: 1,
        completedCount: 1,
        overdueCount: 0,
        lastActivityDate: "2026-10-30T10:00:00Z",
      },
    ],
  };

  const mockCandidates = [
    {
      id: "c1",
      name: "Candidate One",
      email: "c1@test.com",
      phone: "1111111111",
      position: "Full Stack Java Developer",
      status: "NEW",
      assignedToId: null,
      assignedToName: null,
      resumeName: "resume1.pdf",
      resumeFileId: "res1",
      appliedDate: "2026-10-25T00:00:00Z",
      updatedAt: "2026-10-25T00:00:00Z",
    },
    {
      id: "c2",
      name: "Candidate Two",
      email: "c2@test.com",
      phone: "2222222222",
      position: "DevOps Engineer",
      status: "INTERVIEW_SCHEDULED",
      assignedToId: "HR01",
      assignedToName: "Alice HR",
      resumeName: "resume2.pdf",
      resumeFileId: "res2",
      appliedDate: "2026-10-20T00:00:00Z",
      updatedAt: "2026-10-28T00:00:00Z",
    },
  ];

  beforeEach(() => {
    workloadServiceMock = {
      getOverview: vi.fn().mockResolvedValue(mockOverview),
      getCandidates: vi.fn().mockResolvedValue({
        items: mockCandidates,
        total: 2,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }),
      getAssignmentHistory: vi.fn().mockResolvedValue([
        {
          _id: "h1",
          candidateId: "c2",
          candidateName: "Candidate Two",
          previousAssigneeId: null,
          previousAssigneeName: null,
          assignedToId: "HR01",
          assignedToName: "Alice HR",
          assignedByUserId: "admin",
          assignedByName: "Admin",
          assignedAt: "2026-10-28T00:00:00Z",
          action: "ASSIGNED",
          reason: "Initial assignment",
        },
      ]),
      getActivityFeed: vi.fn().mockResolvedValue([
        {
          _id: "a1",
          candidateId: "c2",
          candidateName: "Candidate Two",
          type: "ASSIGNED",
          message: "Assigned candidate to Alice HR",
          performedBy: "Admin",
          performedByUserId: "admin",
          createdAt: "2026-10-28T00:00:00Z",
        },
      ]),
      assignCandidates: vi.fn().mockResolvedValue({ items: [] }),
      getHrDetails: vi.fn().mockResolvedValue({
        hr: mockOverview.hrMembers[0],
        currentCandidates: [mockCandidates[1]],
        previousCandidates: [],
        historyRecords: [],
      }),
    };

    candidateServiceMock = {
      candidates$: of(mockCandidates),
      getActive: vi.fn().mockReturnValue(mockCandidates),
      getAll: vi.fn().mockReturnValue(mockCandidates),
      loadFromBackend: vi.fn().mockResolvedValue(mockCandidates),
    };

    employeeServiceMock = {
      employees$: of(mockOverview.hrMembers),
      loadFromBackend: vi.fn().mockResolvedValue(mockOverview.hrMembers),
    };

    cdrMock = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn(),
    };

    component = new HrWorkloadComponent(
      workloadServiceMock,
      candidateServiceMock,
      employeeServiceMock,
      cdrMock,
    );
  });

  it("loads overview, candidates, history, and activity feed on initialization", async () => {
    await component.ngOnInit();

    expect(workloadServiceMock.getOverview).toHaveBeenCalled();
    expect(workloadServiceMock.getCandidates).toHaveBeenCalled();
    expect(candidateServiceMock.loadFromBackend).toHaveBeenCalled();
    expect(employeeServiceMock.loadFromBackend).toHaveBeenCalled();
    expect(workloadServiceMock.getAssignmentHistory).toHaveBeenCalled();
    expect(workloadServiceMock.getActivityFeed).toHaveBeenCalled();

    expect(component.overview?.summary.totalActiveCandidates).toBe(10);
    expect(component.candidates.length).toBe(2);
    expect(component.history.length).toBe(1);
    expect(component.activities.length).toBe(1);
  });

  it("toggles single candidate and all candidates selection correctly", () => {
    component.candidates = mockCandidates;

    expect(component.isCandidateSelected("c1")).toBe(false);
    component.toggleCandidateSelection("c1");
    expect(component.isCandidateSelected("c1")).toBe(true);

    component.toggleSelectAll();
    expect(component.allOnPageSelected()).toBe(true);

    component.toggleSelectAll();
    expect(component.allOnPageSelected()).toBe(false);
    expect(component.selectedCandidateIds.size).toBe(0);
  });

  it("opens assign modal for individual candidate and submits assignment", async () => {
    component.overview = mockOverview;
    component.openAssignModalForOne(mockCandidates[0]);

    expect(component.showAssignModal).toBe(true);
    expect(component.assignTargetCandidates.length).toBe(1);
    expect(component.assignTargetCandidates[0].id).toBe("c1");

    component.selectedTargetHrId = "HR01";
    component.assignmentReason = "New hire batch";

    await component.submitAssignment();

    expect(workloadServiceMock.assignCandidates).toHaveBeenCalledWith(
      ["c1"],
      "HR01",
      "New hire batch",
    );
    expect(component.showAssignModal).toBe(false);
  });

  it("opens and loads HR profile details modal", async () => {
    await component.viewHrDetails("HR01");

    expect(component.showHrModal).toBe(true);
    expect(workloadServiceMock.getHrDetails).toHaveBeenCalledWith("HR01");
    expect(component.selectedHrDetails?.hr.name).toBe("Alice HR");
    expect(component.selectedHrDetails?.currentCandidates.length).toBe(1);

    component.closeHrModal();
    expect(component.showHrModal).toBe(false);
  });

  it("handles card quick filter click to filter candidates", () => {
    component.filterByCard("unassigned");
    expect(component.activeTab).toBe("candidates");
    expect(component.selectedHrFilter).toBe("unassigned");
    expect(workloadServiceMock.getCandidates).toHaveBeenCalled();
  });
});
