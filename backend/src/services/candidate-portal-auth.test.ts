import { describe, expect, it, vi, beforeEach } from "vitest";
import { candidateService } from "./candidate.service";
import { resumeService } from "./resume.service";
import { emailService } from "./email.service";
import { activityLogService } from "./activity-log.service";
import { PaymentModel } from "../models/payment.model";
import { CandidateModel } from "../models/candidate.model";
import { ResumeFileModel } from "../models/resume-file.model";
import { HttpError } from "../middleware/error-handler";

describe("Candidate Portal Authorization Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(activityLogService, "record").mockResolvedValue(undefined as any);
    vi.spyOn(emailService, "sendCandidateEmail").mockResolvedValue(undefined as any);
  });

  describe("Receipt Download Authorization (Fix 1)", () => {
    const mockPayment = {
      receiptNumber: "RCP-101",
      status: "Verified",
      candidateId: "CAN-12345",
      amount: 10000,
      paidAt: new Date(),
      receiptIssueDate: new Date(),
    };

    const mockCandidate = {
      id: "CAN-12345",
      _id: "CAN-12345",
      name: "Test Candidate",
    };

    it("allows a candidate to download their own receipt using candidateId", async () => {
      vi.spyOn(PaymentModel, "findOne").mockResolvedValue(mockPayment as any);
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockCandidate as any);

      const actor = { candidateId: "CAN-12345", role: "CANDIDATE" as const };
      const result = await candidateService.getReceiptPdf("RCP-101", actor);

      expect(result.pdfBuffer).toBeDefined();
      expect(result.filename).toBe("TVK-Receipt-RCP-101.pdf");
    });

    it("rejects candidate trying to download another candidate's receipt with 403 Forbidden", async () => {
      vi.spyOn(PaymentModel, "findOne").mockResolvedValue(mockPayment as any);
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockCandidate as any);

      const attacker = { candidateId: "CAN-ATTACKER", role: "CANDIDATE" as const };
      await expect(candidateService.getReceiptPdf("RCP-101", attacker)).rejects.toThrow(
        new HttpError(403, "FORBIDDEN", "You are not authorized to view another candidate's receipt.")
      );
    });

    it("allows HR / Manager to download any candidate receipt", async () => {
      vi.spyOn(PaymentModel, "findOne").mockResolvedValue(mockPayment as any);
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockCandidate as any);

      const hrActor = { id: "EMP-HR01", role: "HR" as const, name: "HR Manager", email: "hr@example.com", username: "hr1", employeeId: "EMP-HR01", active: true, mustChangePassword: false };
      const result = await candidateService.getReceiptPdf("RCP-101", hrActor);

      expect(result.pdfBuffer).toBeDefined();
      expect(result.filename).toBe("TVK-Receipt-RCP-101.pdf");
    });
  });

  describe("Resume Download Authorization (Fix 3)", () => {
    const mockCandidate = {
      id: "CAN-12345",
      _id: "CAN-12345",
      resumeFileId: "RES-FILE-123",
    };

    const mockResume = {
      _id: "RES-FILE-123",
      candidateId: "CAN-12345",
      originalName: "my-resume.pdf",
      mimeType: "application/pdf",
      data: Buffer.from("%PDF-1.4 sample content"),
    };

    it("allows candidate to stream their own resume", async () => {
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockCandidate as any);
      vi.spyOn(ResumeFileModel, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue(mockResume),
      } as any);

      const result = await resumeService.streamCandidateResume("CAN-12345", "RES-FILE-123");
      expect(result.filename).toBe("my-resume.pdf");
      expect(result.mimeType).toBe("application/pdf");
      expect(result.stream).toBeDefined();
    });

    it("rejects candidate requesting another candidate's resume file with 403 Forbidden", async () => {
      vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockCandidate as any);

      await expect(
        resumeService.streamCandidateResume("CAN-12345", "RES-OTHER-999")
      ).rejects.toThrow(
        new HttpError(403, "FORBIDDEN", "You are not authorized to access another candidate's resume.")
      );
    });

    it("rejects candidate when resume file belongs to a different candidate with 403 Forbidden", async () => {
      vi.spyOn(CandidateModel, "findById").mockResolvedValue({
        id: "CAN-12345",
        _id: "CAN-12345",
        resumeFileId: "RES-FILE-123",
      } as any);
      vi.spyOn(ResumeFileModel, "findById").mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: "RES-FILE-123",
          candidateId: "CAN-OTHER-CANDIDATE",
          originalName: "other-resume.pdf",
          mimeType: "application/pdf",
          data: Buffer.from("%PDF-1.4 other content"),
        }),
      } as any);

      await expect(
        resumeService.streamCandidateResume("CAN-12345", "RES-FILE-123")
      ).rejects.toThrow(
        new HttpError(403, "FORBIDDEN", "You are not authorized to access another candidate's resume.")
      );
    });
  });

  describe("Candidate Credential Management by Manager", () => {
    const mockManagerActor = {
      id: "MGR-001",
      role: "MANAGER" as const,
      name: "Portal Manager",
      email: "manager@tvk.com",
      username: "manager",
      employeeId: "EMP-MGR01",
      active: true,
      mustChangePassword: false,
    };

    const mockCandidateDoc = {
      _id: "cand-active-1",
      id: "cand-active-1",
      name: "Suresh Kumar",
      email: "suresh@example.com",
      accountCreated: true,
      accountUsername: "suresh_old",
      accountPasswordHash: "old_hashed_value",
      save: vi.fn().mockResolvedValue(true),
    };

    it("updates candidate username and password securely and hashes new password", async () => {
      vi.spyOn(candidateService as any, "findInboundOrAccessible").mockResolvedValue(mockCandidateDoc as any);
      vi.spyOn(CandidateModel, "findOne").mockResolvedValue(null); // No collision

      const result = await candidateService.updateCandidateCredentials(
        "cand-active-1",
        { username: "suresh_new", newPassword: "NewSecretPassword!2026" },
        mockManagerActor,
      );

      expect(result.success).toBe(true);
      expect(result.username).toBe("suresh_new");
      expect(mockCandidateDoc.accountUsername).toBe("suresh_new");
      // Password must be hashed with bcrypt, never plain text
      expect(mockCandidateDoc.accountPasswordHash).not.toBe("NewSecretPassword!2026");
      expect(mockCandidateDoc.accountPasswordHash.startsWith("$2")).toBe(true);
      expect(mockCandidateDoc.save).toHaveBeenCalled();
    });

    it("prevents changing username to one that is already taken by another candidate", async () => {
      vi.spyOn(candidateService as any, "findInboundOrAccessible").mockResolvedValue(mockCandidateDoc as any);
      vi.spyOn(CandidateModel, "findOne").mockResolvedValue({
        _id: "cand-other-99",
        accountUsername: "already_taken",
      } as any);

      await expect(
        candidateService.updateCandidateCredentials(
          "cand-active-1",
          { username: "already_taken", newPassword: "SecurePassword!99" },
          mockManagerActor,
        )
      ).rejects.toThrow(new HttpError(409, "USERNAME_EXISTS", "Username 'already_taken' is already taken by another candidate."));
    });
  });
});
