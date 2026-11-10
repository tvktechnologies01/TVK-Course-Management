import "@angular/compiler";
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { Observable, of } from "rxjs";
import { DomSanitizer } from "@angular/platform-browser";
import { CandidatePortalComponent } from "./candidate-portal";
import { CandidatePortalService } from "../../core/services/candidate-portal.service";
import { Candidate } from "../../core/models/candidate.model";
import { ActivatedRoute, Router } from "@angular/router";

describe("CandidatePortalComponent", () => {
  let component: CandidatePortalComponent;
  let portalServiceMock: {
    getMyDetails: ReturnType<typeof vi.fn>;
    isLoggedIn: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    clearToken: ReturnType<typeof vi.fn>;
    downloadReceipt: ReturnType<typeof vi.fn>;
    downloadCertificate: ReturnType<typeof vi.fn>;
    downloadMyResume: ReturnType<typeof vi.fn>;
    submitCorrectionRequest: ReturnType<typeof vi.fn>;
    getCurriculum: ReturnType<typeof vi.fn>;
    downloadCurriculum: ReturnType<typeof vi.fn>;
  };
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let routeMock: { queryParams: Observable<Record<string, string>> };
  let sanitizerMock: { bypassSecurityTrustResourceUrl: ReturnType<typeof vi.fn> };

  const mockCandidate: Candidate = {
    id: "cand-777",
    name: "Aravind Kumar",
    email: "aravind@example.com",
    phone: "9876543210",
    position: "Software Developer",
    experience: "1 Year",
    location: "Bangalore",
    skills: ["Java", "Angular"],
    resumeName: "aravind.pdf",
    resumeFileId: "res-file-123",
    assignedToId: null,
    assignedToName: null,
    appliedDate: new Date().toISOString(),
    lastContactedAt: null,
    nextFollowUpAt: null,
    notes: "",
    status: "SELECTED",
    source: "WEBSITE_APPLICATION",
    totalFee: 20000,
    amountPaid: 10000,
    balance: 10000,
    paymentStatus: "Partially Paid",
    paymentQrCode: "data:image/png;base64,sampleqr",
    courseCompleted: true,
    certificateStatus: "ISSUED",
    certificateId: "TVK-2026-0099",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    if (typeof (globalThis as any).window === "undefined") {
      (globalThis as any).window = {
        URL: {
          createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
          revokeObjectURL: vi.fn(),
        },
      };
    }
    if (typeof (globalThis as any).document === "undefined") {
      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue({ click: vi.fn() }),
      };
    }

    portalServiceMock = {
      getMyDetails: vi.fn().mockReturnValue(of(mockCandidate)),
      isLoggedIn: vi.fn().mockReturnValue(true),
      setToken: vi.fn(),
      clearToken: vi.fn(),
      downloadReceipt: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4"]))),
      downloadCertificate: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4"]))),
      downloadMyResume: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4"]))),
      submitCorrectionRequest: vi.fn().mockReturnValue(of({ success: true, message: "Correction request submitted to HR successfully." })),
      getCurriculum: vi.fn().mockReturnValue(
        of({
          available: true,
          courseName: "Software Developer",
          curriculumFileName: "Software-Dev-Curriculum.pdf",
          curriculumFileType: "pdf",
          curriculumFileSize: 1048576,
          curriculumUploadedAt: "2026-03-01T10:00:00.000Z",
        }),
      ),
      downloadCurriculum: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4-Curriculum"]))),
    };

    routerMock = {
      navigateByUrl: vi.fn(),
    };

    routeMock = {
      queryParams: of({ id: "cand-777" }),
    };

    sanitizerMock = {
      bypassSecurityTrustResourceUrl: vi.fn().mockImplementation((url: string) => `safe:${url}`),
    };

    component = new CandidatePortalComponent(
      portalServiceMock as unknown as CandidatePortalService,
      routerMock as unknown as Router,
      routeMock as unknown as ActivatedRoute,
      undefined,
      sanitizerMock as unknown as DomSanitizer,
    );
  });

  it("should initialize and load candidate details when authenticated", () => {
    component.ngOnInit();
    expect(portalServiceMock.isLoggedIn).toHaveBeenCalled();
    expect(portalServiceMock.getMyDetails).toHaveBeenCalled();
    expect(component.isAuthenticated).toBe(true);
    expect(component.candidate?.name).toBe("Aravind Kumar");
    expect(component.candidate?.certificateId).toBe("TVK-2026-0099");
  });

  it("should switch tabs correctly", () => {
    component.switchTab("PAYMENTS");
    expect(component.activeTab).toBe("PAYMENTS");

    component.switchTab("COURSE");
    expect(component.activeTab).toBe("COURSE");

    component.switchTab("CERTIFICATE");
    expect(component.activeTab).toBe("CERTIFICATE");
  });

  it("should clear session and candidate on logout and redirect to candidate login", () => {
    component.isAuthenticated = true;
    component.candidate = mockCandidate;
    component.logout();

    expect(portalServiceMock.clearToken).toHaveBeenCalled();
    expect(component.isAuthenticated).toBe(false);
    expect(component.candidate).toBeNull();
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith("/candidate-login");
  });

  it("should toggle and close mobile sidebar drawer", () => {
    expect(component.mobileMenuOpen).toBe(false);
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen).toBe(true);

    component.closeMobileMenu();
    expect(component.mobileMenuOpen).toBe(false);

    component.toggleMobileMenu();
    expect(component.mobileMenuOpen).toBe(true);
    component.switchTab("COURSE");
    expect(component.mobileMenuOpen).toBe(false);
  });

  it("should download candidate's own resume via portalService", () => {
    component.candidate = mockCandidate;
    const createObjectUrlSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-resume-url");
    const revokeObjectUrlSpy = vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    component.downloadResume();

    expect(portalServiceMock.downloadMyResume).toHaveBeenCalledWith("res-file-123");
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:mock-resume-url");
  });

  it("should refresh candidate details immediately after submitting correction request", () => {
    component.candidate = mockCandidate;
    component.correctionText = "Please update my phone number.";
    portalServiceMock.getMyDetails.mockClear();

    component.submitCorrection();

    expect(portalServiceMock.submitCorrectionRequest).toHaveBeenCalledWith("Please update my phone number.");
    expect(component.actionSuccess).toBe("Correction request submitted to HR successfully.");
    expect(portalServiceMock.getMyDetails).toHaveBeenCalledTimes(1);
  });

  it("should preview certificate using DomSanitizer and revoke Blob URL on close and onDestroy", () => {
    component.candidate = mockCandidate;
    const createObjectUrlSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-cert-url");
    const revokeObjectUrlSpy = vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    component.previewCertificate();

    expect(portalServiceMock.downloadCertificate).toHaveBeenCalled();
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(sanitizerMock.bypassSecurityTrustResourceUrl).toHaveBeenCalledWith("blob:mock-cert-url");
    expect(component.previewPdfUrl).toBe("safe:blob:mock-cert-url");

    // Close preview
    component.closePreview();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:mock-cert-url");
    expect(component.previewPdfUrl).toBeNull();

    // Calling preview again then onDestroy
    component.previewCertificate();
    expect(component.previewPdfUrl).toBe("safe:blob:mock-cert-url");
    component.ngOnDestroy();
    expect(component.previewPdfUrl).toBeNull();
  });

  it("should replace all whitespace in multi-word task statuses with hyphens", () => {
    expect(component.getTaskStatusClass("Needs Revision From HR")).toBe("needs-revision-from-hr");
    expect(component.getTaskStatusClass("In Review")).toBe("in-review");
    expect(component.getTaskStatusClass("Not   Started\tYet")).toBe("not-started-yet");
    expect(component.getTaskStatusClass("Completed")).toBe("completed");
    expect(component.getTaskStatusClass("")).toBe("");
  });

  it("should fetch course curriculum details on initialization", () => {
    component.ngOnInit();
    expect(portalServiceMock.getCurriculum).toHaveBeenCalled();
    expect(component.curriculumInfo).toBeTruthy();
    expect(component.curriculumInfo?.available).toBe(true);
    expect(component.curriculumInfo?.curriculumFileName).toBe("Software-Dev-Curriculum.pdf");
    expect(component.formatCurriculumSize(component.curriculumInfo?.curriculumFileSize)).toBe("1.0 MB");
  });

  it("should download course curriculum document via portalService", () => {
    component.curriculumInfo = {
      available: true,
      courseName: "Java Full Stack",
      curriculumFileName: "Java-Full-Stack-Curriculum.pdf",
    };
    const createObjectUrlSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-curr-url");
    const revokeObjectUrlSpy = vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    component.downloadCurriculum();

    expect(portalServiceMock.downloadCurriculum).toHaveBeenCalled();
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:mock-curr-url");
  });
});
