import { describe, expect, it, vi, beforeEach } from "vitest";
import { candidateService } from "./candidate.service";
import { activityLogService } from "./activity-log.service";
import { CandidateModel } from "../models/candidate.model";
import { CourseModel } from "../models/course.model";

describe("Contact Manager & Support Notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(activityLogService, "record").mockResolvedValue(undefined as any);
  });

  const mockExistingCandidate = {
    _id: "cand-777",
    id: "cand-777",
    name: "Vikram Seth",
    email: "vikram@example.com",
    normalizedEmail: "vikram@example.com",
    phone: "9876543210",
    courseName: "DevOps Engineering",
    accountCreated: true,
    accountUsername: "vikram.seth",
    correctionRequests: [],
    save: vi.fn().mockResolvedValue(true),
    markModified: vi.fn(),
  };

  it("submits contact manager request and appends to existing candidate record", async () => {
    vi.spyOn(CandidateModel, "findOne").mockResolvedValue(mockExistingCandidate as any);

    const input = {
      name: "Vikram Seth",
      email: "vikram@example.com",
      phone: "9876543210",
      courseName: "DevOps Engineering",
      issueDescription: "I cannot login with my manager-provided password.",
    };

    const result = await candidateService.submitContactManagerRequest(input);

    expect(result.success).toBe(true);
    expect(result.message).toContain("Your request has been submitted successfully");
    expect(mockExistingCandidate.correctionRequests.length).toBe(1);
    expect((mockExistingCandidate.correctionRequests[0] as any).status).toBe("Pending");
    expect((mockExistingCandidate.correctionRequests[0] as any).courseName).toBe("DevOps Engineering");
    expect(mockExistingCandidate.save).toHaveBeenCalled();
  });

  it("creates a candidate record if candidate does not exist yet when contacting manager", async () => {
    vi.spyOn(CandidateModel, "findOne").mockResolvedValue(null);
    const saveMock = vi.fn().mockResolvedValue(true);
    vi.spyOn(CandidateModel.prototype, "save").mockImplementation(saveMock);

    const input = {
      name: "New Student",
      email: "newstudent@example.com",
      phone: "9123456780",
      courseName: "Cloud Engineering with AWS & Azure",
      issueDescription: "Need assistance regarding login credentials.",
    };

    const result = await candidateService.submitContactManagerRequest(input);

    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
    expect(saveMock).toHaveBeenCalled();
  });

  it("retrieves notifications including candidate details and support requests", async () => {
    const mockDbCandidates = [
      {
        _id: "cand-1",
        name: "Aarti Verma",
        email: "aarti@example.com",
        phone: "9876543211",
        courseName: "Full Stack Development with Java & Angular",
        accountCreated: true,
        accountUsername: "aarti.verma",
        correctionRequests: [
          {
            id: "req-101",
            candidateName: "Aarti Verma",
            email: "aarti@example.com",
            phone: "9876543211",
            courseName: "Full Stack Development with Java & Angular",
            requestText: "Need password reset.",
            requestedAt: new Date("2026-10-29T09:00:00Z"),
            status: "Pending",
          },
        ],
      },
    ];

    vi.spyOn(CandidateModel, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockDbCandidates),
    } as any);

    const actor = {
      id: "MGR-1",
      role: "MANAGER" as const,
      name: "Manager",
      email: "mgr@example.com",
      username: "mgr",
      employeeId: "EMP-MGR01",
      active: true,
      mustChangePassword: false,
    };

    const notifications = await candidateService.getAllCorrectionRequests(actor);

    expect(notifications.length).toBe(1);
    expect(notifications[0].candidateName).toBe("Aarti Verma");
    expect(notifications[0].email).toBe("aarti@example.com");
    expect(notifications[0].phone).toBe("9876543211");
    expect(notifications[0].courseName).toBe("Full Stack Development with Java & Angular");
    expect(notifications[0].status).toBe("Pending");
    expect(notifications[0].accountCreated).toBe(true);
  });

  it("updates request status to In Progress and Resolved", async () => {
    const candidateDoc = {
      id: "cand-1",
      name: "Aarti Verma",
      correctionRequests: [
        {
          id: "req-101",
          status: "Pending",
          completedAt: null,
          completedBy: null,
        },
      ],
      save: vi.fn().mockResolvedValue(true),
      markModified: vi.fn(),
      toJSON: vi.fn().mockReturnValue({ id: "cand-1" }),
    };

    vi.spyOn(candidateService as any, "findInboundOrAccessible").mockResolvedValue(candidateDoc as any);

    const actor = {
      id: "MGR-1",
      role: "MANAGER" as const,
      name: "Manager",
      email: "mgr@example.com",
      username: "mgr",
      employeeId: "EMP-MGR01",
      active: true,
      mustChangePassword: false,
    };

    // Update to In Progress
    const res1 = await candidateService.updateCorrectionRequestStatus("cand-1", "req-101", "In Progress", actor);
    expect(res1.success).toBe(true);
    expect(candidateDoc.correctionRequests[0].status).toBe("In Progress");

    // Update to Resolved
    const res2 = await candidateService.updateCorrectionRequestStatus("cand-1", "req-101", "Resolved", actor);
    expect(res2.success).toBe(true);
    expect(candidateDoc.correctionRequests[0].status).toBe("Resolved");
    expect(candidateDoc.correctionRequests[0].completedAt).toBeDefined();
    expect(candidateDoc.correctionRequests[0].completedBy).toBe("Manager");
  });

  it("returns course list from database or default courses", async () => {
    vi.spyOn(CourseModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { name: "DevOps Engineering" },
          { name: "Java Full Stack" },
        ]),
      }),
    } as any);

    const courses = await candidateService.getPublicCourses();
    expect(courses).toEqual(["DevOps Engineering", "Java Full Stack"]);
  });
});
