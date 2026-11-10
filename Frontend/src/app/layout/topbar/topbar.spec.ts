import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { of } from "rxjs";
import { TopbarComponent } from "./topbar";

describe("TopbarComponent - Candidate Requests & Support", () => {
  let component: TopbarComponent;
  let authMock: any;
  let routerMock: any;
  let candidateServiceMock: any;
  let trainerServiceMock: any;

  const mockNotification = {
    id: "req-1",
    candidateId: "cand-123",
    candidateName: "Priya Sharma",
    email: "priya@example.com",
    phone: "9876543210",
    courseName: "Cloud Engineering with AWS & Azure",
    requestText: "I forgot my portal password and cannot log in.",
    requestedAt: "2026-10-29T10:00:00.000Z",
    status: "Pending" as const,
    accountCreated: true,
    accountUsername: "priya.sharma",
  };

  const mockFacultyAlert = {
    trainerId: "TRN-001",
    trainerName: "Suresh Raina",
    status: "ON_LEAVE",
    leaveType: "SICK",
    leaveReason: "High fever",
    startDate: "2026-11-02",
    expectedReturnDate: "2026-11-04",
    affectedStudentsCount: 18,
    affectedBatches: [],
    backupOptions: [],
  };

  beforeEach(() => {
    authMock = {
      role: "MANAGER",
      user: { name: "Manager Admin", role: "MANAGER" },
    };

    routerMock = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true)),
    };

    candidateServiceMock = {
      getCorrectionRequests: vi.fn().mockReturnValue(of([mockNotification])),
      updateCorrectionRequestStatus: vi.fn().mockReturnValue(of({ success: true })),
      resetCandidatePassword: vi.fn().mockReturnValue(of({ success: true, emailSent: true })),
      createCandidateAccount: vi.fn().mockReturnValue(of({ success: true, username: "priya.sharma" })),
    };

    trainerServiceMock = {
      getFacultyDailyAttendance: vi.fn().mockResolvedValue({
        date: "2026-11-02",
        stats: { totalFaculty: 5, present: 4, onLeave: 1, absent: 0 },
        alerts: [mockFacultyAlert],
      }),
    };

    component = new TopbarComponent(
      authMock,
      routerMock,
      candidateServiceMock,
      trainerServiceMock
    );
  });

  it("should load notifications, faculty alerts, and calculate pendingCount", async () => {
    component.loadNotifications(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(component.notifications.length).toBe(1);
    expect(component.facultyAlerts.length).toBe(1);
    expect(component.pendingCount).toBe(2);
  });

  it("should navigate to trainer management when a faculty leave alert is clicked", () => {
    component.onFacultyAlertClick(mockFacultyAlert);
    expect(routerMock.navigate).toHaveBeenCalledWith(["/trainer-management"]);
    expect(component.showNotifications).toBe(false);
  });

  it("should open request review modal when a notification is clicked", () => {
    component.onNotificationClick(mockNotification);
    expect(component.selectedRequest).toEqual(mockNotification);
    expect(component.showNotifications).toBe(false);
  });

  it("should update request status to In Progress and Resolved", () => {
    component.selectedRequest = { ...mockNotification };
    component.updateStatus("In Progress");

    expect(candidateServiceMock.updateCorrectionRequestStatus).toHaveBeenCalledWith(
      "cand-123",
      "req-1",
      "In Progress"
    );
    expect(component.selectedRequest.status).toBe("In Progress");

    component.updateStatus("Resolved");
    expect(candidateServiceMock.updateCorrectionRequestStatus).toHaveBeenCalledWith(
      "cand-123",
      "req-1",
      "Resolved"
    );
    expect(component.selectedRequest.status).toBe("Resolved");
  });

  it("should reset candidate password securely through existing workflow", () => {
    component.selectedRequest = { ...mockNotification, accountCreated: true };
    component.resetPassword();

    expect(candidateServiceMock.resetCandidatePassword).toHaveBeenCalledWith("cand-123");
    expect(component.actionFeedback).toContain("Password has been reset securely");
  });

  it("should create candidate account and email credentials when no account exists", () => {
    component.selectedRequest = {
      ...mockNotification,
      accountCreated: false,
      accountUsername: undefined,
    };
    component.createAccount();

    expect(candidateServiceMock.createCandidateAccount).toHaveBeenCalledWith(
      "cand-123",
      "priya"
    );
    expect(component.selectedRequest.accountCreated).toBe(true);
    expect(component.actionFeedback).toContain("Portal account created successfully");
  });

  it("should navigate to candidate portal account in external resumes from the modal", () => {
    component.selectedRequest = { ...mockNotification };
    component.goToCandidatePortalAccount();

    expect(routerMock.navigate).toHaveBeenCalledWith(["/external-resumes"], {
      queryParams: {
        candidateId: "cand-123",
        section: "portal-account",
      },
    });
    expect(component.selectedRequest).toBeNull();
  });

  it("should navigate to candidate profile from the modal", () => {
    component.selectedRequest = { ...mockNotification };
    component.goToCandidateProfile();

    expect(routerMock.navigate).toHaveBeenCalledWith(["/candidates", "cand-123"]);
    expect(component.selectedRequest).toBeNull();
  });
});
