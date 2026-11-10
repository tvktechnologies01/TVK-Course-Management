import { describe, expect, it, vi, beforeEach } from "vitest";
import { candidateService, CandidateRepository } from "./candidate.service";
import { CandidateModel } from "../models/candidate.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { activityLogService } from "./activity-log.service";

describe("Certificate Generation & Verification Lifecycle Tests", () => {
  const managerAccount: AuthenticatedAccount = {
    id: "MGR-001",
    role: "MANAGER",
    name: "Operations Manager",
    email: "manager@tvktech.com",
    username: "manager",
    employeeId: "EMP-MGR-001",
    active: true,
    mustChangePassword: false,
  };

  const hrAccount: AuthenticatedAccount = {
    id: "HR-001",
    role: "HR",
    name: "Priya Sharma",
    email: "priya@tvktech.com",
    username: "priya",
    employeeId: "EMP-HR-001",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(activityLogService, "record").mockResolvedValue(undefined);
  });

  describe("Course Completion Requirement", () => {
    it("refuses to issue certificate if course is not completed", async () => {
      const incompleteCandidate = {
        id: "CAN-001",
        _id: "CAN-001",
        name: "Rahul Dravid",
        courseName: "Java Full Stack Development",
        courseCompleted: false,
        completionDate: null,
      };
      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(incompleteCandidate as any);

      await expect(
        candidateService.generateCertificate("CAN-001", managerAccount)
      ).rejects.toThrow(
        new HttpError(400, "COURSE_NOT_COMPLETED", "Candidate course must be marked as completed with a completion date before generating certificate.")
      );
    });

    it("refuses to issue certificate if enrolled course is completely missing", async () => {
      const noCourseCandidate = {
        id: "CAN-002",
        _id: "CAN-002",
        name: "Anil Kumble",
        courseCompleted: true,
        completionDate: "2026-10-15",
        courseName: "",
        position: "",
        programmingLanguage: "",
      };
      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(noCourseCandidate as any);

      await expect(
        candidateService.generateCertificate("CAN-002", managerAccount)
      ).rejects.toThrow(
        new HttpError(400, "ENROLLMENT_DATA_MISSING", "Candidate does not have an enrolled course on record to issue a certificate.")
      );
    });
  });

  describe("Dynamic Certificate Generation", () => {
    it("successfully generates certificate with unique CERT-ID using database records", async () => {
      let savedCandidate: any = null;
      const completedCandidate = {
        id: "CAN-003",
        _id: "CAN-003",
        name: "Shalini",
        courseName: "Internet of Things with Solar",
        courseDuration: "3 Months",
        courseCompleted: true,
        completionDate: "2026-09-28",
        certificateStatus: "NOT_ISSUED",
        certificateId: null,
        toJSON: function () { return this; },
      };

      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(completedCandidate as any);
      vi.spyOn(CandidateRepository.prototype, "update").mockImplementation(async (c) => {
        savedCandidate = c;
        return c;
      });

      const result = await candidateService.generateCertificate("CAN-003", managerAccount);

      expect(savedCandidate).toBeDefined();
      expect(savedCandidate.certificateStatus).toBe("ISSUED");
      expect(savedCandidate.certificateId).toMatch(/^CERT-\d{4}-[A-Z0-9]{6}$/);
      expect(savedCandidate.courseName).toBe("Internet of Things with Solar");
      expect(result.certificateStatus).toBe("ISSUED");
    });

    it("prevents duplicate certificate generation for the same completed candidate unless regenerate is requested", async () => {
      const alreadyIssued = {
        id: "CAN-004",
        _id: "CAN-004",
        name: "Meera Nair",
        courseName: "Cloud Engineering with AWS & Azure",
        courseCompleted: true,
        completionDate: "2026-09-20",
        certificateStatus: "ISSUED",
        certificateId: "CERT-2026-ORIGINAL",
        toJSON: function () { return this; },
      };

      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(alreadyIssued as any);
      const updateSpy = vi.spyOn(CandidateRepository.prototype, "update");

      const result = await candidateService.generateCertificate("CAN-004", managerAccount, false);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(result.certificateId).toBe("CERT-2026-ORIGINAL");
    });
  });

  describe("Certificate PDF Generation & Download Authorization", () => {
    it("generates authentic PDF buffer with candidate, course, issue date, and QR verification", async () => {
      const issuedCandidate = {
        id: "CAN-005",
        _id: "CAN-005",
        name: "Shalini",
        courseName: "Internet of Things with Solar",
        courseDuration: "3 Months",
        courseCompleted: true,
        completionDate: "2026-09-28",
        certificateStatus: "ISSUED",
        certificateId: "CERT-2026-6FHY8",
        certificateIssuedAt: new Date("2026-09-28T10:00:00Z"),
        certificateSignatory: "Dr. V. Kumar",
      };

      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(issuedCandidate as any);

      const { pdfBuffer, pngBuffer, filename, pdfFilename } = await candidateService.getCertificatePdf("CAN-005");

      expect(pngBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(filename).toBe("TVK-Certificate-CERT-2026-6FHY8.png");
      expect(pdfFilename).toBe("TVK-Certificate-CERT-2026-6FHY8.pdf");

      const pngResult = await candidateService.getCertificatePng("CAN-005");
      expect(pngResult.pngBuffer).toBeInstanceOf(Buffer);
      expect(pngResult.filename).toBe("TVK-Certificate-CERT-2026-6FHY8.png");
      expect(pngResult.contentType).toBe("image/png");

      const pdfText = pdfBuffer.toString("binary");
      expect(pdfText).toContain("Shalini");
      expect(pdfText).toContain("Internet of Things with Solar");
      expect(pdfText).toContain("CERT-2026-6FHY8");
      expect(pdfText).toContain("TVK Technologies Edu Private Limited");
      expect(pdfText).toContain("SCAN TO VERIFY");
    });

    it("throws 400 if certificate has not been generated yet", async () => {
      const unissuedCandidate = {
        id: "CAN-006",
        _id: "CAN-006",
        name: "Vikram Seth",
        courseCompleted: true,
        completionDate: "2026-10-01",
        certificateStatus: "NOT_ISSUED",
        certificateId: null,
      };

      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(unissuedCandidate as any);

      await expect(
        candidateService.getCertificatePdf("CAN-006")
      ).rejects.toThrow(
        new HttpError(400, "CERTIFICATE_NOT_ISSUED", "Certificate has not been generated or issued for this candidate.")
      );
    });
  });

  describe("Public Certificate Verification (QR Code endpoint)", () => {
    it("verifies authentic issued certificate by certificateId", async () => {
      const verifiedCandidate = {
        id: "CAN-007",
        _id: "CAN-007",
        name: "Shalini",
        courseName: "Internet of Things with Solar",
        courseDuration: "3 Months",
        courseCompleted: true,
        completionDate: "2026-09-28",
        certificateStatus: "ISSUED",
        certificateId: "CERT-2026-6FHY8",
        certificateIssuedAt: new Date("2026-09-28T10:00:00Z"),
        certificateSignatory: "Dr. V. Kumar",
      };

      vi.spyOn(CandidateRepository.prototype, "findOne").mockResolvedValue(verifiedCandidate as any);

      const verification = await candidateService.verifyCertificatePublic("CERT-2026-6FHY8");

      expect(verification.valid).toBe(true);
      expect(verification.status).toBe("AUTHENTIC");
      expect(verification.candidateName).toBe("Shalini");
      expect(verification.courseName).toBe("Internet of Things with Solar");
      expect(verification.certificateId).toBe("CERT-2026-6FHY8");
      expect(verification.issuer).toBe("TVK Technologies Edu Private Limited");
    });

    it("returns 404 for unissued or nonexistent certificate ID", async () => {
      vi.spyOn(CandidateRepository.prototype, "findOne").mockResolvedValue(null);

      await expect(
        candidateService.verifyCertificatePublic("CERT-FAKE-999")
      ).rejects.toThrow(
        new HttpError(404, "CERTIFICATE_NOT_FOUND", "Certificate with ID 'CERT-FAKE-999' was not found or has not been issued.")
      );
    });

    it("revokes an issued certificate and records the reason", async () => {
      const issuedCandidate = {
        id: "CAN-004",
        _id: "CAN-004",
        name: "Deepak",
        courseName: "Cloud Computing AWS",
        courseCompleted: true,
        completionDate: "2026-09-01",
        certificateStatus: "ISSUED",
        certificateId: "CERT-2026-REV01",
        toJSON: function () { return this; },
      };
      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(issuedCandidate as any);
      vi.spyOn(CandidateRepository.prototype, "update").mockImplementation(async (c) => c);

      const revoked = await candidateService.revokeCertificate("CAN-004", "Course requirements not met", managerAccount);
      expect(revoked.certificateStatus).toBe("REVOKED");
      expect(revoked.certificateRevocationReason).toBe("Course requirements not met");
      expect(revoked.certificateRevokedAt).toBeDefined();
    });

    it("returns invalid revoked status when verifying a revoked certificate", async () => {
      const revokedCandidate = {
        id: "CAN-004",
        _id: "CAN-004",
        name: "Deepak",
        courseName: "Cloud Computing AWS",
        certificateStatus: "REVOKED",
        certificateId: "CERT-2026-REV01",
        certificateRevokedAt: new Date(),
        certificateRevocationReason: "Administrative revocation",
      };
      vi.spyOn(CandidateRepository.prototype, "findOne").mockResolvedValue(revokedCandidate as any);

      const verification = await candidateService.verifyCertificatePublic("CERT-2026-REV01");
      expect(verification.valid).toBe(false);
      expect(verification.status).toBe("REVOKED");
      expect(verification.revocationReason).toBe("Administrative revocation");
    });

    it("refuses to download a revoked certificate", async () => {
      const revokedCandidate = {
        id: "CAN-004",
        _id: "CAN-004",
        name: "Deepak",
        certificateStatus: "REVOKED",
        certificateId: "CERT-2026-REV01",
      };
      vi.spyOn(CandidateRepository.prototype, "findById").mockResolvedValue(revokedCandidate as any);

      await expect(
        candidateService.getCertificatePdf("CAN-004")
      ).rejects.toThrow(
        new HttpError(400, "CERTIFICATE_REVOKED", "Certificate 'CERT-2026-REV01' has been revoked and can no longer be downloaded.")
      );
    });
  });
});
