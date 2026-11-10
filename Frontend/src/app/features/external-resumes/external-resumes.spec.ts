import "@angular/compiler";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { Observable, of } from "rxjs";
import { ExternalResumesComponent } from "./external-resumes";
import { CandidateService } from "../../core/services/candidate.service";
import { Candidate } from "../../core/models/candidate.model";
import { ActivatedRoute } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

describe("ExternalResumesComponent", () => {
  let component: ExternalResumesComponent;
  let candidateServiceMock: {
    getInbound: ReturnType<typeof vi.fn>;
    getOutbound: ReturnType<typeof vi.fn>;
    createOutbound: ReturnType<typeof vi.fn>;
    updateCourseDetails: ReturnType<typeof vi.fn>;
    uploadPaymentQr: ReturnType<typeof vi.fn>;
    getPaymentToken: ReturnType<typeof vi.fn>;
    getCandidatePayments: ReturnType<typeof vi.fn>;
    verifyPayment: ReturnType<typeof vi.fn>;
    rejectPayment: ReturnType<typeof vi.fn>;
    downloadReceipt: ReturnType<typeof vi.fn>;
    downloadOfferLetter: ReturnType<typeof vi.fn>;
    createCandidateAccount: ReturnType<typeof vi.fn>;
    resetCandidatePassword: ReturnType<typeof vi.fn>;
    updateAccountCredentials: ReturnType<typeof vi.fn>;
    markCourseCompletion: ReturnType<typeof vi.fn>;
    generateCertificate: ReturnType<typeof vi.fn>;
    downloadCertificate: ReturnType<typeof vi.fn>;
    previewCertificate: ReturnType<typeof vi.fn>;
    sendEmail: ReturnType<typeof vi.fn>;
    getCommonPaymentQr: ReturnType<typeof vi.fn>;
    uploadCommonPaymentQr: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
    getCandidateById: ReturnType<typeof vi.fn>;
  };
  let routeMock: { queryParams: Observable<any> };

  const mockCandidate: Candidate = {
    id: "cand-inbound-1",
    name: "Meera Nair",
    email: "meera@example.com",
    phone: "9876543210",
    position: "Full Stack Java",
    experience: "Fresher",
    location: "Kochi",
    skills: ["Java", "Spring Boot"],
    source: "WEBSITE_APPLICATION",
    resumeName: "meera_resume.pdf",
    status: "NEW",
    assignedToId: "EMP-HR-001",
    assignedToName: "Priya Sharma",
    appliedDate: new Date().toISOString(),
    lastContactedAt: null,
    nextFollowUpAt: null,
    notes: "Applied via website",
    totalFee: 30000,
    amountPaid: 15000,
    balance: 15000,
    paymentStatus: "Partially Paid",
    paymentToken: "tok-12345",
    paymentTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOutboundCandidate: Candidate = {
    id: "cand-outbound-1",
    name: "Rohan Varma",
    email: "rohan@example.com",
    phone: "9812345678",
    position: "Python & Data Science",
    experience: "2 Years",
    location: "Chennai",
    skills: ["Python", "Pandas"],
    source: "OUTBOUND",
    resumeName: "rohan_cv.pdf",
    status: "NEW",
    assignedToId: "EMP-HR-001",
    assignedToName: "Priya Sharma",
    appliedDate: new Date().toISOString(),
    lastContactedAt: null,
    nextFollowUpAt: null,
    notes: "Received via email referral",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    candidateServiceMock = {
      getInbound: vi.fn().mockReturnValue(
        of({
          items: [mockCandidate],
          pagination: { total: 1, page: 1, pageSize: 500, pageCount: 1 },
        }),
      ),
      getOutbound: vi.fn().mockReturnValue(
        of({
          items: [mockOutboundCandidate],
          pagination: { total: 1, page: 1, pageSize: 500, pageCount: 1 },
        }),
      ),
      createOutbound: vi.fn().mockReturnValue(of(mockOutboundCandidate)),
      updateCourseDetails: vi.fn().mockReturnValue(of({ ...mockCandidate, totalFee: 35000 })),
      uploadPaymentQr: vi.fn().mockReturnValue(of({ ...mockCandidate, paymentQrCode: "data:image/png;base64,sample" })),
      getPaymentToken: vi.fn().mockReturnValue(of({ paymentToken: "tok-12345", expiresAt: "2026-11-27", candidateId: "cand-inbound-1", name: "Meera Nair" })),
      getCandidatePayments: vi.fn().mockReturnValue(of([])),
      verifyPayment: vi.fn().mockReturnValue(of({ payment: { id: "p-1", amount: 15000, receiptNumber: "RCP-2026-101" }, candidate: mockCandidate })),
      rejectPayment: vi.fn().mockReturnValue(of({ payment: { id: "p-1", status: "Rejected" }, candidate: mockCandidate })),
      downloadReceipt: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4"]))),
      downloadOfferLetter: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4"]))),
      createCandidateAccount: vi.fn().mockReturnValue(of({ success: true, username: "meera_nair", emailSent: true, offerLetterAttached: true })),
      resetCandidatePassword: vi.fn().mockReturnValue(of({ success: true, emailSent: true })),
      updateAccountCredentials: vi.fn().mockReturnValue(
        of({
          success: true,
          username: "meera_portal",
          password: "NewSecret!2026",
          emailSent: true,
          message: "Updated credentials for 'meera_portal' saved securely and emailed to candidate.",
        })
      ),
      markCourseCompletion: vi.fn().mockReturnValue(of({ ...mockCandidate, courseCompleted: true })),
      generateCertificate: vi.fn().mockReturnValue(of({ ...mockCandidate, certificateStatus: "ISSUED", certificateId: "TVK-2026-0042" })),
      downloadCertificate: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4"]))),
      previewCertificate: vi.fn().mockReturnValue(of(new Blob(["%PDF-1.4"]))),
      sendEmail: vi.fn().mockResolvedValue({ result: { sent: true }, candidate: mockCandidate }),
      getCommonPaymentQr: vi.fn().mockReturnValue(of({ qrCode: "data:image/png;base64,common_qr_123" })),
      uploadCommonPaymentQr: vi.fn().mockReturnValue(of({ qrCode: "data:image/png;base64,new_common_qr_456", message: "Updated" })),
      assign: vi.fn().mockResolvedValue(undefined),
      getCandidateById: vi.fn().mockReturnValue(of({ success: true, data: mockCandidate })),
    };

    routeMock = {
      queryParams: of({}),
    };

    component = new ExternalResumesComponent(
      candidateServiceMock as unknown as CandidateService,
      routeMock as unknown as ActivatedRoute,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should initialize with Inbound category by default and load inbound candidates", () => {
    component.ngOnInit();
    expect(component.activeCategory).toBe("INBOUND");
    expect(candidateServiceMock.getInbound).toHaveBeenCalled();
    expect(component.inboundCandidates.length).toBe(1);
    expect(component.filteredInbound[0].name).toBe("Meera Nair");
  });

  it("should switch to Outbound category and load outbound candidates", () => {
    component.switchCategory("OUTBOUND");
    expect(component.activeCategory).toBe("OUTBOUND");
    expect(candidateServiceMock.getOutbound).toHaveBeenCalled();
    expect(component.outboundCandidates.length).toBe(1);
    expect(component.filteredOutbound[0].name).toBe("Rohan Varma");
    expect(component.outboundTotalCount).toBe(1);
  });

  it("clears outbound candidates and updates the count when the server returns no applications", () => {
    component.switchCategory("OUTBOUND");
    expect(component.outboundTotalCount).toBe(1);

    candidateServiceMock.getOutbound.mockReturnValueOnce(
      of({ items: [], pagination: { total: 0, page: 1, pageSize: 500, pageCount: 0 } }),
    );
    component.loadOutboundCandidates();

    expect(component.outboundCandidates).toEqual([]);
    expect(component.filteredOutbound).toEqual([]);
    expect(component.outboundTotalCount).toBe(0);
  });

  it("shows the global outbound count for HR without loading candidates assigned to other recruiters", () => {
    const hrComponent = new ExternalResumesComponent(
      candidateServiceMock as unknown as CandidateService,
      routeMock as unknown as ActivatedRoute,
      undefined,
      { role: "HR" } as AuthService,
    );
    candidateServiceMock.getOutbound.mockReturnValueOnce(
      of({
        items: [],
        totalOutboundCount: 5,
        pagination: { total: 0, page: 1, pageSize: 500, pageCount: 0 },
      }),
    );

    hrComponent.switchCategory("OUTBOUND");

    expect(hrComponent.outboundTotalCount).toBe(5);
    expect(hrComponent.outboundCandidates).toEqual([]);
  });

  it("keeps the last known outbound count after refresh if an older API omits the global total", () => {
    const storedCounts = new Map<string, string>([["recruitment-crm:outbound-resume-count", "5"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storedCounts.get(key) ?? null,
      setItem: (key: string, value: string) => storedCounts.set(key, value),
    });
    const hrComponent = new ExternalResumesComponent(
      candidateServiceMock as unknown as CandidateService,
      routeMock as unknown as ActivatedRoute,
      undefined,
      { role: "HR" } as AuthService,
    );
    candidateServiceMock.getOutbound.mockReturnValue(
      of({ items: [], pagination: { total: 0, page: 1, pageSize: 500, pageCount: 0 } }),
    );

    expect(hrComponent.outboundTotalCount).toBe(5);
    hrComponent.switchCategory("OUTBOUND");
    expect(hrComponent.outboundTotalCount).toBe(5);

    candidateServiceMock.getOutbound.mockReturnValueOnce(
      of({
        items: [],
        totalOutboundCount: 0,
        pagination: { total: 0, page: 1, pageSize: 500, pageCount: 0 },
      }),
    );
    hrComponent.loadOutboundCandidates();
    expect(hrComponent.outboundTotalCount).toBe(0);
    expect(storedCounts.get("recruitment-crm:outbound-resume-count")).toBe("0");
  });

  it("offers manual and email entry methods when adding an outbound resume", () => {
    component.openAddOutboundModal();

    expect(component.showOutboundModal).toBe(true);
    expect(component.outboundEntryMethod).toBeNull();

    component.selectOutboundEntryMethod("MANUAL_TYPING");
    expect(component.outboundEntryMethod).toBe("MANUAL_TYPING");
  });

  it("provides the requested 16 courses in the outbound course dropdown", () => {
    expect(component.outboundCourseOptions).toHaveLength(16);
    expect(component.outboundCourseOptions).toContain("Japanese Spoken Course");
  });

  it("does not allow HR to upload a payment QR code", () => {
    const hrComponent = new ExternalResumesComponent(
      candidateServiceMock as unknown as CandidateService,
      routeMock as unknown as ActivatedRoute,
      undefined,
      { role: "HR" } as AuthService,
    );
    hrComponent.selectedCandidate = mockCandidate;

    hrComponent.onQrFileSelected({} as Event);

    expect(candidateServiceMock.uploadPaymentQr).not.toHaveBeenCalled();
    expect(component.outboundCourseOptions).toContain("AI and Data Science");
  });

  it("saves manually entered outbound details through the existing API", () => {
    component.openAddOutboundModal();
    component.selectOutboundEntryMethod("MANUAL_TYPING");
    component.outboundName = "Asha Kumar";
    component.outboundEmail = "asha@example.com";
    component.outboundPhone = "9876543210";
    component.outboundPosition = "Full Stack Development with Java & Angular";

    component.submitOutboundCandidate();

    expect(candidateServiceMock.createOutbound).toHaveBeenCalledOnce();
    const formData = candidateServiceMock.createOutbound.mock.calls[0][0] as FormData;
    expect(formData.get("entryMethod")).toBe("MANUAL_TYPING");
    expect(formData.get("email")).toBe("asha@example.com");
    expect(formData.get("position")).toBe("Full Stack Development with Java & Angular");
    expect(component.showOutboundModal).toBe(false);
    expect(component.outboundCandidates[0].id).toBe(mockOutboundCandidate.id);
  });

  it("routes newly registered outbound candidates to Admin for HR assignment", () => {
    candidateServiceMock.createOutbound.mockReturnValueOnce(of({ ...mockOutboundCandidate, id: "cand-outbound-new", assignedToId: null, assignedToName: null }));
    component.openAddOutboundModal();
    component.selectOutboundEntryMethod("MANUAL_TYPING");
    component.outboundName = "Rajesh Nair";
    component.outboundEmail = "rajesh@example.com";
    component.outboundPhone = "9876543219";
    component.outboundPosition = "Full Stack Development with Java & Angular";

    component.submitOutboundCandidate();

    expect(candidateServiceMock.createOutbound).toHaveBeenCalled();
    expect(component.showOutboundModal).toBe(false);
    expect(component.successMessage).toContain("routed to Admin for HR assignment");
  });

  it("requires a resume file for the email-received entry method", () => {
    component.openAddOutboundModal();
    component.selectOutboundEntryMethod("RECEIVED_FROM_EMAIL");
    component.outboundName = "Asha Kumar";
    component.outboundEmail = "asha@example.com";
    component.outboundPhone = "9876543210";
    component.outboundPosition = "Java Developer";

    component.submitOutboundCandidate();

    expect(candidateServiceMock.createOutbound).not.toHaveBeenCalled();
    expect(component.outboundFileError).toBe("Attach the resume received by email.");
  });

  it("should filter candidates by search query", () => {
    component.ngOnInit();
    component.searchQuery = "Meera";
    component.applyInboundFilter();
    expect(component.filteredInbound.length).toBe(1);

    component.searchQuery = "NonExistent";
    component.applyInboundFilter();
    expect(component.filteredInbound.length).toBe(0);
  });

  it("should select candidate and populate course details", () => {
    component.selectCandidate(mockCandidate);
    expect(component.selectedCandidate?.id).toBe("cand-inbound-1");
    expect(component.editTotalFee).toBe(30000);
    expect(component.editAmountPaid).toBe(15000);
    expect(component.remainingBalance).toBe(15000);
    expect(candidateServiceMock.getCandidatePayments).toHaveBeenCalledWith("cand-inbound-1");
  });

  it("should create candidate account and display credentials status", () => {
    component.selectCandidate(mockCandidate);
    component.accountUsernameInput = "meera_nair";
    component.createAccount();

    expect(candidateServiceMock.createCandidateAccount).toHaveBeenCalled();
    expect(component.accountSuccess).toContain("Portal account created for 'meera_nair'");
  });

  it("should validate username, password length, and password match before saving updated credentials", () => {
    component.selectCandidate({ ...mockCandidate, accountCreated: true, accountUsername: "meera_old" });

    // Invalid short username
    component.accountUsernameInput = "ab";
    component.accountNewPasswordInput = "Secret123";
    component.accountConfirmPasswordInput = "Secret123";
    component.saveAndEmailCredentials();
    expect(component.errorMessage).toContain("Portal username must be at least 3 characters");

    // Invalid short password
    component.accountUsernameInput = "meera_updated";
    component.accountNewPasswordInput = "12345";
    component.accountConfirmPasswordInput = "12345";
    component.saveAndEmailCredentials();
    expect(component.errorMessage).toContain("New password must be at least 6 characters");

    // Passwords mismatch
    component.accountNewPasswordInput = "Secret123";
    component.accountConfirmPasswordInput = "Mismatch999";
    component.saveAndEmailCredentials();
    expect(component.errorMessage).toContain("Passwords do not match");
  });

  it("should save and email updated credentials to candidate and retain old password", () => {
    component.selectCandidate({ ...mockCandidate, accountCreated: true, accountUsername: "meera_old", accountPassword: "OldPassword123" });
    expect(component.selectedCandidate?.accountPassword).toBe("OldPassword123");
    expect(component.showOldPassword).toBe(false);

    component.accountUsernameInput = "meera_updated";
    component.accountNewPasswordInput = "NewSecret!2026";
    component.accountConfirmPasswordInput = "NewSecret!2026";

    component.saveAndEmailCredentials();

    expect(candidateServiceMock.updateAccountCredentials).toHaveBeenCalledWith(
      "cand-inbound-1",
      "meera_updated",
      "NewSecret!2026",
      true,
    );
    expect(component.accountSuccess).toContain("Updated credentials for 'meera_portal'");
    expect(component.selectedCandidate?.accountUsername).toBe("meera_portal");
    expect(component.selectedCandidate?.accountPassword).toBe("NewSecret!2026");
    expect(component.accountNewPasswordInput).toBe("");
    expect(component.accountConfirmPasswordInput).toBe("");
  });

  it("should allow downloading the offer letter", () => {
    component.selectCandidate(mockCandidate);
    component.downloadOfferLetter();
    expect(candidateServiceMock.downloadOfferLetter).toHaveBeenCalledWith("cand-inbound-1");
  });

  it("should view and toggle old password correctly", () => {
    component.selectCandidate({ ...mockCandidate, accountCreated: true, accountPassword: "SecretPass!2026" });
    expect(component.showOldPassword).toBe(false);
    expect(component.getOldPasswordDisplay()).toBe("SecretPass!2026");

    component.toggleShowOldPassword();
    expect(component.showOldPassword).toBe(true);

    component.toggleShowOldPassword();
    expect(component.showOldPassword).toBe(false);
  });

  it("should provide clean fallback password display when accountPassword is empty", () => {
    component.selectCandidate({ ...mockCandidate, name: "Balaji S", accountCreated: true, accountPassword: "" });
    expect(component.getOldPasswordDisplay()).toBe("TVK@BalajiS!2026");
  });

  it("should select candidate and scroll when pending candidate id is provided", () => {
    component.pendingSelectCandidateId = "cand-inbound-1";
    component.pendingTargetSection = "portal-account";
    component.inboundCandidates = [{ ...mockCandidate }];

    component.checkPendingCandidateSelection();

    expect(component.selectedCandidate?.id).toBe("cand-inbound-1");
    expect(component.pendingSelectCandidateId).toBeUndefined();
  });

  it("should not contain 'Partially Paid' in paymentStatusOptions", () => {
    expect((component.paymentStatusOptions as readonly string[])).not.toContain("Partially Paid");
    expect((component.paymentStatusOptions as readonly string[])).toContain("Pending");
    expect((component.paymentStatusOptions as readonly string[])).toContain("Paid");
  });

  it("should send payment link via email to candidate", async () => {
    component.selectCandidate(mockCandidate);
    await component.sendPaymentLinkEmail();

    expect(candidateServiceMock.sendEmail).toHaveBeenCalledWith(
      "cand-inbound-1",
      expect.objectContaining({
        to: "meera@example.com",
        subject: expect.stringContaining("Official Payment Link"),
        message: expect.stringContaining("payment/tok-12345"),
      }),
    );
    expect(component.emailPaymentLinkSuccess).toContain("meera@example.com");
  });

  it("should handle email send error gracefully", async () => {
    candidateServiceMock.sendEmail.mockRejectedValueOnce(new Error("SMTP_NOT_CONFIGURED"));
    component.selectCandidate(mockCandidate);
    await component.sendPaymentLinkEmail();

    expect(component.emailPaymentLinkError).toContain("SMTP_NOT_CONFIGURED");
  });

  it("loads common payment QR code on init", () => {
    component.loadCommonPaymentQr();
    expect(candidateServiceMock.getCommonPaymentQr).toHaveBeenCalled();
    expect(component.commonPaymentQr).toBe("data:image/png;base64,common_qr_123");
  });

  it("does not allow non-managers to upload common payment QR code", () => {
    const hrComponent = new ExternalResumesComponent(
      candidateServiceMock as unknown as CandidateService,
      routeMock as unknown as ActivatedRoute,
      undefined,
      { role: "HR" } as AuthService,
    );

    hrComponent.onCommonQrSelected({} as Event);
    expect(candidateServiceMock.uploadCommonPaymentQr).not.toHaveBeenCalled();
    expect(hrComponent.commonQrError).toContain("Unauthorized");
  });

  it("allows manager to upload common payment QR code and updates all candidates", () => {
    const managerComponent = new ExternalResumesComponent(
      candidateServiceMock as unknown as CandidateService,
      routeMock as unknown as ActivatedRoute,
      undefined,
      { role: "MANAGER" } as AuthService,
    );

    managerComponent.inboundCandidates = [{ ...mockCandidate }];
    managerComponent.outboundCandidates = [{ ...mockOutboundCandidate }];

    const fakeFile = new File(["dummy content"], "office-qr.png", { type: "image/png" });
    const eventMock = {
      target: {
        files: [fakeFile],
        value: "c:\\fakepath\\office-qr.png",
      },
    } as unknown as Event;

    managerComponent.onCommonQrSelected(eventMock);

    expect(candidateServiceMock.uploadCommonPaymentQr).toHaveBeenCalledWith(fakeFile);
    expect(managerComponent.commonPaymentQr).toBe("data:image/png;base64,new_common_qr_456");
    expect(managerComponent.inboundCandidates[0].paymentQrCode).toBe("data:image/png;base64,new_common_qr_456");
    expect(managerComponent.outboundCandidates[0].paymentQrCode).toBe("data:image/png;base64,new_common_qr_456");
    expect(managerComponent.commonQrSuccess).toContain("Official payment QR code updated successfully");
  });

  it("opens candidate popup and sets qrCodePreview to candidate QR or common QR", () => {
    component.commonPaymentQr = "data:image/png;base64,shared_qr";
    const candidateWithoutCustomQr = { ...mockCandidate, paymentQrCode: "" };
    component.selectCandidate(candidateWithoutCustomQr);

    expect(component.selectedCandidate?.id).toBe(candidateWithoutCustomQr.id);
    expect(component.qrCodePreview).toBe("data:image/png;base64,shared_qr");
  });

  it("displays newly created unassigned outbound candidates in the list without vanishing", () => {
    const unassignedCreated: Candidate = {
      ...mockOutboundCandidate,
      id: "cand-outbound-new",
      name: "Aakash Verma",
      assignedToId: null,
      assignedToName: null,
      status: "NEW",
    };
    candidateServiceMock.createOutbound.mockReturnValue(of(unassignedCreated));

    component.switchCategory("OUTBOUND");
    candidateServiceMock.getOutbound.mockReturnValueOnce(
      of({
        items: [unassignedCreated, mockOutboundCandidate],
        pagination: { total: 2, page: 1, pageSize: 500, pageCount: 1 },
      }),
    );
    component.openAddOutboundModal();
    component.selectOutboundEntryMethod("MANUAL_TYPING");
    component.outboundName = "Aakash Verma";
    component.outboundEmail = "aakash@example.com";
    component.outboundPhone = "9876543210";
    component.outboundPosition = "Full Stack Java";

    component.submitOutboundCandidate();

    expect(candidateServiceMock.createOutbound).toHaveBeenCalled();
    expect(component.showOutboundModal).toBe(false);
    expect(component.outboundCandidates.some((c) => c.id === "cand-outbound-new")).toBe(true);
    expect(component.filteredOutbound.some((c) => c.id === "cand-outbound-new")).toBe(true);
    expect(component.successMessage).toContain("routed to Admin for HR assignment");
  });

  it("filters outbound candidates correctly by Pending HR Assignment and Assigned", () => {
    const unassigned: Candidate = {
      ...mockOutboundCandidate,
      id: "out-unassigned",
      assignedToId: null,
      assignedToName: null,
    };
    const assigned: Candidate = {
      ...mockOutboundCandidate,
      id: "out-assigned",
      assignedToId: "EMP-HR-001",
      assignedToName: "Priya Sharma",
    };

    component.outboundCandidates = [unassigned, assigned];

    // Filter ALL
    component.outboundAssignmentFilter = "ALL";
    component.applyOutboundFilter();
    expect(component.filteredOutbound.length).toBe(2);

    // Filter PENDING
    component.outboundAssignmentFilter = "PENDING";
    component.applyOutboundFilter();
    expect(component.filteredOutbound.length).toBe(1);
    expect(component.filteredOutbound[0].id).toBe("out-unassigned");

    // Filter ASSIGNED
    component.outboundAssignmentFilter = "ASSIGNED";
    component.applyOutboundFilter();
    expect(component.filteredOutbound.length).toBe(1);
    expect(component.filteredOutbound[0].id).toBe("out-assigned");
  });

  it("allows assigning an unassigned outbound candidate to HR", async () => {
    const unassigned: Candidate = {
      ...mockOutboundCandidate,
      id: "out-unassigned-2",
      name: "Suresh Raina",
      assignedToId: null,
      assignedToName: null,
      status: "NEW",
    };
    component.hrEmployees = [
      { id: "EMP-HR-001", name: "Priya Sharma", role: "HR", email: "priya@tvk.com", username: "priya", active: true },
    ];
    component.outboundCandidates = [unassigned];
    component.selectCandidate(unassigned);

    await component.assignCandidate("EMP-HR-001");

    expect(candidateServiceMock.assign).toHaveBeenCalledWith("out-unassigned-2", "EMP-HR-001", "Priya Sharma");
    expect(component.selectedCandidate?.assignedToId).toBe("EMP-HR-001");
    expect(component.selectedCandidate?.status).toBe("ASSIGNED");
    expect(component.outboundCandidates[0].assignedToId).toBe("EMP-HR-001");
    expect(component.successMessage).toContain("successfully assigned to Priya Sharma");
  });
});
