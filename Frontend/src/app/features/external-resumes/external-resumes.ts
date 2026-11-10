import { ChangeDetectorRef, Component, OnDestroy, OnInit, Optional, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { firstValueFrom } from "rxjs";
import { Candidate, CandidateStatus, PaymentRecord } from "../../core/models/candidate.model";
import { CandidateService } from "../../core/services/candidate.service";
import { ApiPage } from "../../core/services/api.service";
import { AuthService } from "../../core/services/auth.service";
import { EmployeeService } from "../../core/services/employee.service";

@Component({
  selector: "app-external-resumes",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./external-resumes.html",
  styleUrl: "./external-resumes.css",
})
export class ExternalResumesComponent implements OnInit, OnDestroy {
  private readonly outboundCountStorageKey = "recruitment-crm:outbound-resume-count";
  private readonly candidateService: CandidateService;
  private readonly route: ActivatedRoute;
  private readonly authService?: AuthService;
  private readonly employeeService?: EmployeeService;
  private readonly sanitizer?: DomSanitizer;

  hrEmployees: ReturnType<EmployeeService["getHr"]> = [];
  assigneeHrId = "";
  assigningCandidate = false;
  refreshing = false;
  lastRefreshedAt: Date | null = null;
  private autoRefreshTimer: any = null;
  private focusHandler?: () => void;

  get canManagePaymentQr(): boolean {
    return this.authService?.role === "MANAGER";
  }

  get canManagePayments(): boolean {
    return this.authService?.role === "MANAGER";
  }

  activeCategory: "INBOUND" | "OUTBOUND" = "INBOUND";

  // Shared Common Payment QR Controls
  commonPaymentQr = "";
  loadingCommonQr = false;
  uploadingCommonQr = false;
  commonQrSuccess = "";
  commonQrError = "";

  // Inbound Candidates List
  inboundCandidates: Candidate[] = [];
  filteredInbound: Candidate[] = [];
  inboundTotalCount = 0;
  loadingInbound = true;

  // Outbound Candidates List
  outboundCandidates: Candidate[] = [];
  filteredOutbound: Candidate[] = [];
  outboundTotalCount = 0;
  loadingOutbound = false;
  outboundAssignmentFilter: "ALL" | "PENDING" | "ASSIGNED" = "ALL";
  outboundHrFilter = "ALL";

  get pendingOutboundCount(): number {
    return this.outboundCandidates.filter((c) => !c.assignedToId).length;
  }

  get activeCategoryLoading(): boolean {
    if (this.activeCategory === "INBOUND") return this.loadingInbound;
    if (this.activeCategory === "OUTBOUND") return this.loadingOutbound;
    return false;
  }

  // Manage Modal State
  manageModalTab: "COURSE" | "PROFILE" | "QR" | "PAYMENTS" | "ACCOUNT" | "CERTIFICATE" = "COURSE";

  // Selected Candidate Drawer
  selectedCandidate: Candidate | null = null;
  candidatePayments: PaymentRecord[] = [];
  loadingPayments = false;

  // Search & Filter
  searchQuery = "";
  statusFilter = "ALL";
  paymentFilter = "ALL";

  // General Feedback
  errorMessage = "";
  successMessage = "";
  savingCourse = false;
  uploadingQr = false;
  qrUploadError = "";
  copiedPaymentLink = false;
  sendingPaymentEmail = false;
  emailPaymentLinkSuccess = "";
  emailPaymentLinkError = "";

  // Editable Inbound / Course Fields
  editJoiningDate = "";
  editCourseStartDate = "";
  editCourseDuration = "3 Months";
  editCourseName = "";
  editTotalFee = 0;
  editAmountPaid = 0;
  editPaymentStatus: "Pending" | "Verification Pending" | "Partially Paid" | "Paid" | "Rejected" = "Pending";
  editPaymentInstructions = "";
  qrCodePreview = "";

  // Payment Verification Modal
  verifyingPayment: PaymentRecord | null = null;
  verifiedAmountInput = 0;
  verificationNotes = "";
  submittingVerification = false;
  verifyingPaymentError = "";

  // Payment Rejection Modal
  rejectingPayment: PaymentRecord | null = null;
  rejectionReasonInput = "";
  submittingRejection = false;
  rejectingPaymentError = "";

  // Candidate Account Creation & Credential Management
  accountUsernameInput = "";
  accountTempPasswordInput = "";
  accountNewPasswordInput = "";
  accountConfirmPasswordInput = "";
  showAccountPassword = false;
  showOldPassword = false;
  creatingAccount = false;
  resettingPassword = false;
  savingCredentials = false;
  accountSuccess = "";
  attachOfferLetter = true;
  downloadingOfferLetter = false;
  previewingOfferLetter = false;
  showOfferLetterPreview = false;
  offerLetterPreviewUrl: SafeResourceUrl | string | null = null;
  rawOfferLetterPreviewUrl: string | null = null;
  offerLetterPreviewError = "";
  pendingSelectCandidateId?: string;
  pendingTargetSection?: string;

  // Course Completion & Certificate Modal
  markingCompletion = false;
  completionDateInput = "";
  courseCompletedCheck = false;
  generatingCert = false;
  previewPdfUrl: SafeResourceUrl | string | null = null;
  private rawPreviewPdfUrl: string | null = null;
  downloadingCert = false;

  // Outbound Add Candidate Modal
  showOutboundModal = false;
  outboundEntryMethod: "MANUAL_TYPING" | "RECEIVED_FROM_EMAIL" | null = null;
  outboundName = "";
  outboundEmail = "";
  outboundPhone = "";
  outboundPosition = "";
  outboundExperience = "";
  outboundLocation = "";
  outboundSkills = "";
  outboundNotes = "";
  outboundResumeFile: File | null = null;
  outboundFileError = "";
  savingOutbound = false;

  // Candidate Profile Editing Modal
  showEditDetailsModal = false;
  editCandidateName = "";
  editCandidateEmail = "";
  editCandidatePhone = "";
  editCandidatePosition = "";
  editCandidateExperience = "";
  editCandidateLocation = "";
  editCandidateAddress = "";
  editCandidateState = "";
  editCandidatePincode = "";
  editCandidateDob = "";
  editCandidateDegree = "";
  editCandidateCollege = "";
  editCandidateYop = "";
  editCandidateSkills = "";
  editCandidateNotes = "";
  markCorrectionCompletedOnSave = false;
  activeCorrectionIdForEdit = "";
  savingCandidateDetails = false;
  editCandidateError = "";

  readonly outboundCourseOptions = [
    "Full Stack Development with Java & Angular",
    "Cloud Engineering with AWS & Azure",
    "DevOps Engineering",
    "Python for Web Development & Automation",
    "C# & .NET Development",
    "IoT with Embedded C",
    "Digital Marketing",
    "AI with Machine Learning",
    "Python with Data Science",
    "Java with Automation Testing",
    "Java with ReactJS",
    "Hardware and Networking",
    "IoT (Internet of Things)",
    "Robotics",
    "Japanese Spoken Course",
    "AI and Data Science",
  ] as const;

  readonly durationOptions = ["15 Days", "1 Month", "3 Months", "6 Months"];
  readonly paymentStatusOptions = ["Pending", "Verification Pending", "Paid", "Rejected"] as const;

  private readonly cdr: ChangeDetectorRef;

  constructor(
    @Optional() candidateService?: CandidateService,
    @Optional() route?: ActivatedRoute,
    @Optional() cdr?: ChangeDetectorRef,
    @Optional() authService?: AuthService,
  ) {
    this.authService = authService;
    let resolvedCdr = cdr;
    if (!resolvedCdr) {
      try {
        resolvedCdr = inject(ChangeDetectorRef);
      } catch {
        resolvedCdr = { markForCheck: () => {}, detectChanges: () => {} } as unknown as ChangeDetectorRef;
      }
    }
    this.cdr = resolvedCdr;

    let resolvedService = candidateService;
    if (!resolvedService) {
      try {
        resolvedService = inject(CandidateService);
      } catch {
        // unit tests pass mock
      }
    }
    this.candidateService = resolvedService!;

    let resolvedRoute = route;
    if (!resolvedRoute) {
      try {
        resolvedRoute = inject(ActivatedRoute);
      } catch {
        // unit tests pass mock
      }
    }
    this.route = resolvedRoute!;
    this.outboundTotalCount = this.readCachedOutboundCount();

    let resolvedEmployeeService: EmployeeService | undefined;
    try {
      resolvedEmployeeService = inject(EmployeeService);
    } catch {
      // unit tests pass mock
    }
    this.employeeService = resolvedEmployeeService;

    try {
      this.sanitizer = inject(DomSanitizer);
    } catch {
      // unit tests pass mock
    }
  }

  ngOnInit(): void {
    this.loadCommonPaymentQr();
    if (this.employeeService) {
      this.hrEmployees = this.employeeService.getHr();
      this.employeeService.employees$.subscribe(() => {
        if (this.employeeService) {
          this.hrEmployees = this.employeeService.getHr();
          this.cdr.markForCheck();
        }
      });
    }
    this.route.queryParams.subscribe((params) => {
      const candidateId = params["candidateId"] || params["id"];
      const targetSection = params["section"];
      if (candidateId) {
        this.pendingSelectCandidateId = candidateId;
        this.pendingTargetSection = targetSection;
      }
      if (params["tab"] === "outbound") {
        this.activeCategory = "OUTBOUND";
        this.loadOutboundCandidates();
      } else {
        this.activeCategory = "INBOUND";
        this.loadInboundCandidates();
      }
    });

    // Auto-refresh candidate list every 10 seconds in the background
    this.autoRefreshTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        this.refreshActiveList(true);
      }
    }, 10000);

    if (typeof window !== "undefined") {
      this.focusHandler = () => {
        this.refreshActiveList(true);
      };
      window.addEventListener("focus", this.focusHandler);
    }
  }

  refreshActiveList(silent = false): void {
    if (this.activeCategory === "INBOUND") {
      this.loadInboundCandidates(silent);
    } else {
      this.loadOutboundCandidates(silent);
    }
  }

  ngOnDestroy(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
    if (this.focusHandler && typeof window !== "undefined") {
      window.removeEventListener("focus", this.focusHandler);
    }
  }

  loadCommonPaymentQr(): void {
    this.loadingCommonQr = true;
    this.candidateService.getCommonPaymentQr().subscribe({
      next: (res) => {
        this.commonPaymentQr = res?.qrCode || "";
        this.loadingCommonQr = false;
        if (!this.qrCodePreview) {
          this.qrCodePreview = this.commonPaymentQr;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingCommonQr = false;
        this.cdr.markForCheck();
      },
    });
  }

  switchCategory(cat: "INBOUND" | "OUTBOUND"): void {
    this.activeCategory = cat;
    this.selectedCandidate = null;
    this.searchQuery = "";
    this.statusFilter = "ALL";
    this.paymentFilter = "ALL";
    this.errorMessage = "";
    this.successMessage = "";
    this.commonQrSuccess = "";
    this.commonQrError = "";
    this.cdr.markForCheck();

    if (cat === "INBOUND") {
      this.loadInboundCandidates();
    } else {
      this.loadOutboundCandidates();
    }
  }

  get remainingBalance(): number {
    return Math.max(0, (this.editTotalFee || 0) - (this.editAmountPaid || 0));
  }

  // --- Inbound List & Filters ---

  loadInboundCandidates(silent = false): void {
    if (!silent) {
      this.loadingInbound = true;
    } else {
      this.refreshing = true;
    }
    this.errorMessage = "";
    this.cdr.markForCheck();

    this.candidateService.getInbound({ page: 1, pageSize: 500 }).subscribe({
      next: (response: ApiPage<Candidate>) => {
        this.inboundCandidates = response.items || [];
        this.inboundTotalCount = response.pagination?.total ?? this.inboundCandidates.length;
        this.applyInboundFilter();
        this.loadingInbound = false;
        this.refreshing = false;
        this.lastRefreshedAt = new Date();
        this.checkPendingCandidateSelection();
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        if (!silent) {
          this.errorMessage = err?.message || "Failed to load inbound registrations.";
        }
        this.loadingInbound = false;
        this.refreshing = false;
        this.cdr.markForCheck();
      },
    });
  }

  applyInboundFilter(): void {
    let list = [...this.inboundCandidates];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.position && c.position.toLowerCase().includes(q)) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.programmingLanguage && c.programmingLanguage.toLowerCase().includes(q)),
      );
    }

    if (this.statusFilter !== "ALL") {
      list = list.filter((c) => c.status === this.statusFilter);
    }

    if (this.paymentFilter !== "ALL") {
      list = list.filter((c) => (c.paymentStatus || "Pending") === this.paymentFilter);
    }

    this.filteredInbound = list;
    this.cdr.markForCheck();
  }

  // --- Outbound List & Filters ---

  loadOutboundCandidates(silent = false): void {
    if (!silent) {
      this.loadingOutbound = true;
    } else {
      this.refreshing = true;
    }
    this.errorMessage = "";
    this.cdr.markForCheck();

    const params: Record<string, string | number> = { page: 1, pageSize: 500 };

    this.candidateService.getOutbound(params).subscribe({
      next: (response: ApiPage<Candidate>) => {
        this.outboundCandidates = response.items || [];
        const totalCount = response.totalOutboundCount ??
          (this.authService?.role !== "HR" ? response.pagination?.total : undefined);
        if (typeof totalCount === "number" && Number.isSafeInteger(totalCount) && totalCount >= 0) {
          this.setOutboundTotalCount(totalCount);
        }
        this.applyOutboundFilter();
        this.loadingOutbound = false;
        this.refreshing = false;
        this.lastRefreshedAt = new Date();
        this.checkPendingCandidateSelection();
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        if (!silent) {
          this.errorMessage = err?.message || "Failed to load outbound candidates.";
        }
        this.loadingOutbound = false;
        this.refreshing = false;
        this.cdr.markForCheck();
      },
    });
  }

  applyOutboundFilter(): void {
    let list = [...this.outboundCandidates];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.position && c.position.toLowerCase().includes(q)) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.assignedToName && c.assignedToName.toLowerCase().includes(q)),
      );
    }

    if (this.statusFilter !== "ALL") {
      list = list.filter((c) => c.status === this.statusFilter);
    }

    if (this.outboundAssignmentFilter === "PENDING") {
      list = list.filter((c) => !c.assignedToId);
    } else if (this.outboundAssignmentFilter === "ASSIGNED") {
      list = list.filter((c) => !!c.assignedToId);
    }

    if (this.outboundHrFilter !== "ALL") {
      list = list.filter((c) => c.assignedToId === this.outboundHrFilter);
    }

    this.filteredOutbound = list;
    this.cdr.markForCheck();
  }

  onOutboundFilterChange(): void {
    this.applyOutboundFilter();
  }

  private readCachedOutboundCount(): number {
    if (typeof localStorage === "undefined") return 0;
    const storedCount = localStorage.getItem(this.outboundCountStorageKey);
    if (storedCount === null) return 0;
    const count = Number(storedCount);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
  }

  private setOutboundTotalCount(count: number): void {
    this.outboundTotalCount = count;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(this.outboundCountStorageKey, String(count));
    }
  }

  // --- Select & Manage Candidate ---

  cleanCourseTitle(raw?: string | null): string {
    if (!raw) return "";
    return raw.replace(/^(Training|Internship|Placement|Placements|Projects|Project|Job)\s*[-:–—]\s*/i, "").trim();
  }

  switchManageTab(tab: "COURSE" | "PROFILE" | "QR" | "PAYMENTS" | "ACCOUNT" | "CERTIFICATE"): void {
    this.manageModalTab = tab;
    this.cdr.markForCheck();
  }

  selectCandidate(candidate: Candidate, tab?: "COURSE" | "PROFILE" | "QR" | "PAYMENTS" | "ACCOUNT" | "CERTIFICATE"): void {
    const defaultTab = tab ?? (candidate.source === "OUTBOUND" ? "PROFILE" : "COURSE");
    this.selectedCandidate = { ...candidate };
    this.manageModalTab = defaultTab;
    this.errorMessage = "";
    this.successMessage = "";
    this.accountSuccess = "";
    this.qrUploadError = "";
    this.copiedPaymentLink = false;
    this.emailPaymentLinkSuccess = "";
    this.emailPaymentLinkError = "";
    this.sendingPaymentEmail = false;

    // Populate editable fields
    this.editJoiningDate = candidate.joiningDate ? candidate.joiningDate.slice(0, 10) : "";
    this.editCourseStartDate = candidate.courseStartDate
      ? candidate.courseStartDate.slice(0, 10)
      : (candidate.courseDate ? candidate.courseDate.slice(0, 10) : "");
    this.editCourseDuration = candidate.courseDuration || "3 Months";
    this.editCourseName = this.cleanCourseTitle(candidate.courseName || candidate.programmingLanguage || candidate.position || "");
    this.editTotalFee = candidate.totalFee ?? 0;
    this.editAmountPaid = candidate.amountPaid ?? 0;
    this.editPaymentStatus = (candidate.paymentStatus as any) || "Pending";
    this.editPaymentInstructions = candidate.paymentInstructions || "";
    this.qrCodePreview = candidate.paymentQrCode || this.commonPaymentQr || "";

    // Candidate Account Fields
    if (candidate.accountCreated && (!candidate.accountPassword || !candidate.accountPassword.trim())) {
      candidate.accountPassword = this.getOldPasswordDisplayFor(candidate);
    }
    this.accountUsernameInput = candidate.accountUsername || candidate.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    this.accountTempPasswordInput = `TVK@${Math.random().toString(36).slice(-6).toUpperCase()}!99`;
    this.accountNewPasswordInput = "";
    this.accountConfirmPasswordInput = "";
    this.showAccountPassword = false;
    this.showOldPassword = false;
    this.savingCredentials = false;

    // Completion fields
    this.courseCompletedCheck = candidate.courseCompleted ?? false;
    this.completionDateInput = candidate.completionDate ? candidate.completionDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
    this.assigneeHrId = candidate.assignedToId || "";

    this.cdr.markForCheck();
    // Fetch associated payments for verification
    this.loadCandidatePayments(candidate.id);
  }

  getOldPasswordDisplay(): string {
    if (!this.selectedCandidate) return "";
    return this.getOldPasswordDisplayFor(this.selectedCandidate);
  }

  getOldPasswordDisplayFor(candidate: Candidate): string {
    if (candidate.accountPassword && candidate.accountPassword.trim()) {
      return candidate.accountPassword;
    }
    const cleanName = (candidate.name || "Candidate").replace(/[^a-zA-Z]/g, "") || "TVK";
    const initial = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    return `TVK@${initial}!2026`;
  }

  toggleShowOldPassword(): void {
    this.showOldPassword = !this.showOldPassword;
    this.cdr.markForCheck();
  }

  checkPendingCandidateSelection(): void {
    if (!this.pendingSelectCandidateId) return;
    const targetId = this.pendingSelectCandidateId;
    let found = this.inboundCandidates.find(
      (c) => c.id === targetId || (c as any)._id === targetId || c.email?.toLowerCase() === targetId.toLowerCase(),
    );
    if (!found) {
      found = this.outboundCandidates.find(
        (c) => c.id === targetId || (c as any)._id === targetId || c.email?.toLowerCase() === targetId.toLowerCase(),
      );
    }
    if (found) {
      const targetSection = this.pendingTargetSection;
      this.pendingSelectCandidateId = undefined;
      this.pendingTargetSection = undefined;
      this.selectCandidate(found);
      if (targetSection === "portal-account") {
        setTimeout(() => {
          const el = document.getElementById("candidatePortalAccountSection") || document.querySelector(".active-account") || document.querySelector(".create-account");
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 300);
      }
      return;
    }

    // Direct fetch if not yet loaded in list
    this.candidateService.getCandidateById(targetId).subscribe({
      next: (res) => {
        if (res && res.data) {
          const targetSection = this.pendingTargetSection;
          this.pendingSelectCandidateId = undefined;
          this.pendingTargetSection = undefined;
          this.selectCandidate(res.data);
          if (targetSection === "portal-account") {
            setTimeout(() => {
              const el = document.getElementById("candidatePortalAccountSection") || document.querySelector(".active-account") || document.querySelector(".create-account");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 300);
          }
        }
      },
      error: () => {},
    });
  }

  assignCandidate(hrId: string): void {
    if (!this.selectedCandidate || !hrId) return;
    const targetHr = this.hrEmployees.find((e) => e.id === hrId);
    if (!targetHr) return;

    this.assigningCandidate = true;
    this.errorMessage = "";
    this.successMessage = "";
    this.cdr.markForCheck();

    this.candidateService.assign(this.selectedCandidate.id, hrId, targetHr.name)
      .then(() => {
        this.assigningCandidate = false;
        if (this.selectedCandidate) {
          const updated: Candidate = {
            ...this.selectedCandidate,
            assignedToId: hrId,
            assignedToName: targetHr.name,
            status: this.selectedCandidate.status === "NEW" ? "ASSIGNED" : this.selectedCandidate.status,
          };
          this.selectedCandidate = updated;
          this.updateCandidateInLocalLists(updated);
        }
        this.successMessage = `Candidate successfully assigned to ${targetHr.name}!`;
        this.cdr.markForCheck();
      })
      .catch((err: Error) => {
        this.assigningCandidate = false;
        this.errorMessage = err?.message || "Failed to assign candidate.";
        this.cdr.markForCheck();
      });
  }

  closeDetail(): void {
    this.selectedCandidate = null;
    this.candidatePayments = [];
    this.errorMessage = "";
    this.successMessage = "";
    this.cdr.markForCheck();
  }

  loadCandidatePayments(candidateId: string): void {
    this.loadingPayments = true;
    this.cdr.markForCheck();
    this.candidateService.getCandidatePayments(candidateId).subscribe({
      next: (payments) => {
        this.candidatePayments = payments;
        this.loadingPayments = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPayments = false;
        this.cdr.markForCheck();
      },
    });
  }

  // --- Candidate Profile Editing ---

  get pendingCorrectionRequests(): any[] {
    return (this.selectedCandidate?.correctionRequests || []).filter((r) => r.status === "Pending");
  }

  openEditDetails(correctionReq?: any): void {
    if (!this.selectedCandidate) return;
    this.showEditDetailsModal = true;
    this.editCandidateError = "";
    this.activeCorrectionIdForEdit = correctionReq ? correctionReq.id : "";
    this.markCorrectionCompletedOnSave = Boolean(correctionReq || this.pendingCorrectionRequests.length > 0);

    this.editCandidateName = this.selectedCandidate.name || "";
    this.editCandidateEmail = this.selectedCandidate.email || "";
    this.editCandidatePhone = this.selectedCandidate.phone || "";
    this.editCandidatePosition = this.selectedCandidate.position || this.selectedCandidate.courseName || "";
    this.editCandidateExperience = this.selectedCandidate.experience || "";
    this.editCandidateLocation = this.selectedCandidate.location || "";
    this.editCandidateAddress = this.selectedCandidate.address || "";
    this.editCandidateState = this.selectedCandidate.state || "";
    this.editCandidatePincode = this.selectedCandidate.pincode || "";
    this.editCandidateDob = this.selectedCandidate.dateOfBirth || "";
    this.editCandidateDegree = this.selectedCandidate.degree || "";
    this.editCandidateCollege = this.selectedCandidate.college || "";
    this.editCandidateYop = this.selectedCandidate.yearOfPassing || "";
    this.editCandidateSkills = (this.selectedCandidate.skills || []).join(", ");
    this.editCandidateNotes = this.selectedCandidate.notes || "";
    this.cdr.markForCheck();
  }

  closeEditDetails(): void {
    this.showEditDetailsModal = false;
    this.editCandidateError = "";
    this.activeCorrectionIdForEdit = "";
    this.cdr.markForCheck();
  }

  saveCandidateDetails(): void {
    if (!this.selectedCandidate) return;
    if (!this.editCandidateName.trim()) {
      this.editCandidateError = "Full Name is required.";
      this.cdr.markForCheck();
      return;
    }

    this.savingCandidateDetails = true;
    this.editCandidateError = "";
    this.cdr.markForCheck();

    const skillsArray = this.editCandidateSkills
      ? this.editCandidateSkills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const payload: any = {
      name: this.editCandidateName.trim(),
      email: this.editCandidateEmail.trim(),
      phone: this.editCandidatePhone.trim(),
      position: this.editCandidatePosition.trim(),
      experience: this.editCandidateExperience.trim(),
      location: this.editCandidateLocation.trim(),
      address: this.editCandidateAddress.trim(),
      state: this.editCandidateState.trim(),
      pincode: this.editCandidatePincode.trim(),
      dateOfBirth: this.editCandidateDob.trim(),
      degree: this.editCandidateDegree.trim(),
      college: this.editCandidateCollege.trim(),
      yearOfPassing: this.editCandidateYop.trim(),
      skills: skillsArray,
      notes: this.editCandidateNotes.trim(),
    };

    if (this.markCorrectionCompletedOnSave) {
      const targetReqId = this.activeCorrectionIdForEdit || (this.pendingCorrectionRequests[0]?.id);
      if (targetReqId) {
        payload.completedCorrectionRequestId = targetReqId;
      }
    }

    const current = this.selectedCandidate;
    this.candidateService.updateDetails(current.id, payload).subscribe({
      next: (updated: Candidate) => {
        const merged: Candidate = { ...current, ...updated };
        this.selectedCandidate = merged;
        this.updateCandidateInLocalLists(merged);
        this.savingCandidateDetails = false;
        this.showEditDetailsModal = false;
        this.activeCorrectionIdForEdit = "";
        this.successMessage = "Candidate details saved successfully!";
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.savingCandidateDetails = false;
        this.editCandidateError = err?.message || "Failed to update candidate details.";
        this.cdr.markForCheck();
      },
    });
  }

  markCorrectionStatus(requestId: string, status: "Pending" | "Completed"): void {
    if (!this.selectedCandidate) return;
    const current = this.selectedCandidate;
    this.candidateService.updateCorrectionRequestStatus(current.id, requestId, status).subscribe({
      next: (res) => {
        let updated: Candidate;
        if (res?.candidate) {
          updated = { ...current, ...res.candidate };
        } else {
          const reqs = (current.correctionRequests || []).map((r) =>
            r.id === requestId
              ? { ...r, status, completedAt: status === "Completed" ? new Date().toISOString() : null }
              : r,
          );
          updated = { ...current, correctionRequests: reqs as any };
        }
        this.selectedCandidate = updated;
        this.updateCandidateInLocalLists(updated);
        this.successMessage = status === "Completed" ? "Correction request marked as Completed!" : "Correction request reopened as Pending.";
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.errorMessage = err?.message || "Failed to update correction request status.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Save Course & Schedule Details ---

  saveCourseAndPayment(): void {
    if (!this.selectedCandidate) return;

    this.savingCourse = true;
    this.errorMessage = "";
    this.successMessage = "";
    this.cdr.markForCheck();

    const payload = {
      joiningDate: this.editJoiningDate || null,
      courseDate: this.editCourseStartDate || null,
      courseStartDate: this.editCourseStartDate || null,
      courseName: this.cleanCourseTitle(this.editCourseName),
      courseDuration: this.editCourseDuration,
      totalFee: Number(this.editTotalFee) || 0,
      amountPaid: Number(this.editAmountPaid) || 0,
      paymentStatus: this.editPaymentStatus,
      paymentInstructions: this.editPaymentInstructions.trim(),
    };

    this.candidateService.updateCourseDetails(this.selectedCandidate.id, payload).subscribe({
      next: (updated: Candidate) => {
        this.selectedCandidate = { ...updated };
        this.updateCandidateInLocalLists(updated);
        this.savingCourse = false;
        this.successMessage = "Course schedule & payment parameters updated successfully!";
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.savingCourse = false;
        this.errorMessage = err?.message || "Failed to update course details.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Payment QR Code Upload ---

  onQrFileSelected(event: Event): void {
    if (!this.canManagePaymentQr) return;
    const input = event.target as HTMLInputElement;
    this.qrUploadError = "";

    if (!input.files || input.files.length === 0 || !this.selectedCandidate) return;

    const file = input.files[0];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".png", ".jpg", ".jpeg"].includes(ext)) {
      this.qrUploadError = "Only PNG and JPG/JPEG images are supported for QR codes.";
      input.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.qrUploadError = "QR code image size must not exceed 2 MB.";
      input.value = "";
      return;
    }

    // Read immediately so the image shows right away without waiting for refresh!
    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => {
        const localDataUrl = reader.result as string;
        this.qrCodePreview = localDataUrl;
        if (this.selectedCandidate) {
          this.selectedCandidate.paymentQrCode = localDataUrl;
        }
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }

    this.uploadingQr = true;
    this.cdr.markForCheck();
    this.candidateService.uploadPaymentQr(this.selectedCandidate.id, file).subscribe({
      next: (updated: Candidate) => {
        const finalQr = updated.paymentQrCode || this.qrCodePreview;
        this.selectedCandidate = { ...this.selectedCandidate, ...updated, paymentQrCode: finalQr };
        this.qrCodePreview = finalQr;
        this.commonPaymentQr = finalQr;
        this.inboundCandidates.forEach((c) => (c.paymentQrCode = finalQr));
        this.outboundCandidates.forEach((c) => (c.paymentQrCode = finalQr));
        this.updateCandidateInLocalLists(this.selectedCandidate);
        this.uploadingQr = false;
        this.successMessage = "Official payment QR code uploaded successfully and applied across all candidates!";
        input.value = "";
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.uploadingQr = false;
        this.qrUploadError = err?.message || "Failed to upload QR code.";
        input.value = "";
        this.cdr.markForCheck();
      },
    });
  }

  onCommonQrSelected(event: Event): void {
    if (!this.canManagePaymentQr) {
      this.commonQrError = "Unauthorized: Only Managers can replace the official payment QR code.";
      return;
    }
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (![".png", ".jpg", ".jpeg"].includes(ext)) {
      this.commonQrError = "Only PNG and JPG/JPEG images are supported for QR codes.";
      input.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.commonQrError = "QR code image size must not exceed 2 MB.";
      input.value = "";
      return;
    }

    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => {
        const localDataUrl = reader.result as string;
        this.commonPaymentQr = localDataUrl;
        this.qrCodePreview = localDataUrl;
        if (this.selectedCandidate) {
          this.selectedCandidate.paymentQrCode = localDataUrl;
        }
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }

    this.uploadingCommonQr = true;
    this.commonQrError = "";
    this.commonQrSuccess = "";
    this.cdr.markForCheck();

    this.candidateService.uploadCommonPaymentQr(file).subscribe({
      next: (res) => {
        const finalQr = res.qrCode || this.commonPaymentQr;
        this.commonPaymentQr = finalQr;
        this.qrCodePreview = finalQr;
        if (this.selectedCandidate) {
          this.selectedCandidate.paymentQrCode = finalQr;
        }
        this.inboundCandidates.forEach((c) => (c.paymentQrCode = finalQr));
        this.outboundCandidates.forEach((c) => (c.paymentQrCode = finalQr));
        this.uploadingCommonQr = false;
        this.commonQrSuccess = "Official payment QR code updated successfully and applied across all candidates!";
        input.value = "";
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.uploadingCommonQr = false;
        this.commonQrError = err?.error?.message || err?.message || "Failed to upload QR code.";
        input.value = "";
        this.cdr.markForCheck();
      },
    });
  }

  downloadPaymentProof(payment: PaymentRecord): void {
    if (!payment.paymentProofUrl) return;
    try {
      if (payment.paymentProofUrl.startsWith("data:")) {
        const parts = payment.paymentProofUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const ext = mime.includes("pdf") ? "pdf" : mime.includes("jpeg") ? "jpg" : "png";
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `payment-proof-${payment.candidateName || 'candidate'}-${payment.transactionRef || payment.id}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } else {
        const link = document.createElement("a");
        link.href = payment.paymentProofUrl;
        link.download = `payment-proof-${payment.candidateName || 'candidate'}-${payment.transactionRef || payment.id}`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      window.open(payment.paymentProofUrl, "_blank");
    }
  }

  viewPaymentProof(payment: PaymentRecord): void {
    if (!payment.paymentProofUrl) return;
    try {
      if (payment.paymentProofUrl.startsWith("data:")) {
        const parts = payment.paymentProofUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } else {
        window.open(payment.paymentProofUrl, "_blank");
      }
    } catch {
      window.open(payment.paymentProofUrl, "_blank");
    }
  }

  // --- Copy Candidate-Specific Payment Link ---

  copyPaymentLink(): void {
    if (!this.selectedCandidate) return;

    if (!this.selectedCandidate.paymentToken) {
      this.candidateService.getPaymentToken(this.selectedCandidate.id).subscribe({
        next: (res) => {
          if (this.selectedCandidate) this.selectedCandidate.paymentToken = res.paymentToken;
          this.performCopyLink(res.paymentToken);
        },
        error: (err) => {
          this.errorMessage = "Could not generate payment link: " + (err?.message || "");
        },
      });
      return;
    }

    this.performCopyLink(this.selectedCandidate.paymentToken);
  }

  private performCopyLink(token: string): void {
    const url = `${window.location.origin}/payment/${encodeURIComponent(token)}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copiedPaymentLink = true;
      setTimeout(() => (this.copiedPaymentLink = false), 3500);
    });
  }

  async sendPaymentLinkEmail(): Promise<void> {
    if (!this.selectedCandidate || !this.selectedCandidate.email) {
      this.emailPaymentLinkError = "Candidate email address is missing.";
      return;
    }

    this.emailPaymentLinkSuccess = "";
    this.emailPaymentLinkError = "";
    this.sendingPaymentEmail = true;
    this.cdr.markForCheck();

    try {
      let token = this.selectedCandidate.paymentToken;
      if (!token) {
        const res = await firstValueFrom(this.candidateService.getPaymentToken(this.selectedCandidate.id));
        token = res.paymentToken;
        if (this.selectedCandidate) {
          this.selectedCandidate.paymentToken = token;
        }
      }

      const origin = typeof window !== "undefined" && window?.location?.origin ? window.location.origin : "http://localhost:4200";
      const paymentUrl = `${origin}/payment/${encodeURIComponent(token)}`;
      const courseTitle = this.editCourseName || this.selectedCandidate.courseName || this.selectedCandidate.position || "Enrolled Course";
      const subject = `Official Payment Link & Course Details - TVK Technologies`;
      const message = `Dear ${this.selectedCandidate.name},\n\nHere are your course and fee details for TVK Technologies:\n\n- Course: ${courseTitle}\n- Duration: ${this.editCourseDuration}\n- Total Course Fee: ₹${this.editTotalFee || 0}\n- Remaining Balance: ₹${this.remainingBalance}\n${this.editPaymentInstructions ? "- Payment Instructions: " + this.editPaymentInstructions + "\n" : ""}\nPlease find your secure payment link below to view the official QR code and submit your payment details:\n${paymentUrl}\n\nIf you have any questions, feel free to reply directly to this email.\n\nBest regards,\nTVK Technologies Recruitment Team`;

      await this.candidateService.sendEmail(this.selectedCandidate.id, {
        to: this.selectedCandidate.email,
        subject,
        message,
      });

      this.emailPaymentLinkSuccess = `Payment link successfully sent to ${this.selectedCandidate.email}.`;
    } catch (err: unknown) {
      const anyErr = err as any;
      const msg = anyErr?.error?.message || anyErr?.message || "Failed to send email.";
      this.emailPaymentLinkError = `Failed to send email: ${msg}`;
    } finally {
      this.sendingPaymentEmail = false;
      this.cdr.markForCheck();
    }
  }

  // --- Manual Payment Verification & Rejection ---

  openVerifyModal(payment: PaymentRecord): void {
    if (!this.canManagePayments) return;
    this.verifyingPayment = payment;
    this.verifiedAmountInput = Number(payment.amount) || 0;
    this.verificationNotes = "";
    this.verifyingPaymentError = "";
    this.cdr.markForCheck();
  }

  closeVerifyModal(): void {
    this.verifyingPayment = null;
    this.verifyingPaymentError = "";
    this.submittingVerification = false;
    this.cdr.markForCheck();
  }

  submitVerify(): void {
    if (!this.canManagePayments) return;
    if (!this.verifyingPayment) return;

    const candidateId = this.selectedCandidate?.id || (this.selectedCandidate as any)?._id || this.verifyingPayment.candidateId;
    const paymentId = this.verifyingPayment.id || (this.verifyingPayment as any)._id;

    if (!candidateId || !paymentId) {
      this.verifyingPaymentError = "Unable to identify candidate or payment record.";
      this.cdr.markForCheck();
      return;
    }

    const verifiedAmount = Number(this.verifiedAmountInput);
    if (!verifiedAmount || verifiedAmount <= 0) {
      this.verifyingPaymentError = "Please enter a valid verified amount greater than zero.";
      this.cdr.markForCheck();
      return;
    }

    this.submittingVerification = true;
    this.verifyingPaymentError = "";
    this.cdr.markForCheck();

    this.candidateService.verifyPayment(
      candidateId,
      paymentId,
      verifiedAmount,
      this.verificationNotes,
    ).subscribe({
      next: (res) => {
        this.submittingVerification = false;
        this.verifyingPayment = null;
        this.verifyingPaymentError = "";

        if (res.candidate) {
          this.selectedCandidate = { ...res.candidate };
          this.editAmountPaid = res.candidate.amountPaid ?? 0;
          this.editTotalFee = res.candidate.totalFee ?? 0;
          this.editPaymentStatus = (res.candidate.paymentStatus as any) || "Pending";
          this.updateCandidateInLocalLists(res.candidate);
        }

        this.loadCandidatePayments(candidateId);
        this.loadInboundCandidates();
        this.successMessage = `Payment of ₹${res.payment.amount} verified! Official Receipt ${res.payment.receiptNumber || ''} generated successfully.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submittingVerification = false;
        const msg = err?.error?.message || err?.message || "Failed to verify payment.";
        this.verifyingPaymentError = msg;
        this.errorMessage = msg;
        this.cdr.markForCheck();
      },
    });
  }

  openRejectModal(payment: PaymentRecord): void {
    if (!this.canManagePayments) return;
    this.rejectingPayment = payment;
    this.rejectionReasonInput = "";
    this.rejectingPaymentError = "";
    this.cdr.markForCheck();
  }

  closeRejectModal(): void {
    this.rejectingPayment = null;
    this.rejectingPaymentError = "";
    this.submittingRejection = false;
    this.cdr.markForCheck();
  }

  submitReject(): void {
    if (!this.canManagePayments) return;
    if (!this.rejectingPayment || !this.rejectionReasonInput.trim()) {
      this.rejectingPaymentError = "Please provide a rejection reason.";
      this.cdr.markForCheck();
      return;
    }

    const candidateId = this.selectedCandidate?.id || (this.selectedCandidate as any)?._id || this.rejectingPayment.candidateId;
    const paymentId = this.rejectingPayment.id || (this.rejectingPayment as any)._id;

    if (!candidateId || !paymentId) {
      this.rejectingPaymentError = "Unable to identify candidate or payment record.";
      this.cdr.markForCheck();
      return;
    }

    this.submittingRejection = true;
    this.rejectingPaymentError = "";
    this.cdr.markForCheck();

    this.candidateService.rejectPayment(
      candidateId,
      paymentId,
      this.rejectionReasonInput.trim(),
    ).subscribe({
      next: (res) => {
        this.submittingRejection = false;
        this.rejectingPayment = null;
        this.rejectingPaymentError = "";

        if (res.candidate) {
          this.selectedCandidate = { ...res.candidate };
          this.editPaymentStatus = (res.candidate.paymentStatus as any) || "Pending";
          this.updateCandidateInLocalLists(res.candidate);
        }

        this.loadCandidatePayments(candidateId);
        this.loadInboundCandidates();
        this.successMessage = "Payment has been rejected with recorded reason.";
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submittingRejection = false;
        const msg = err?.error?.message || err?.message || "Failed to reject payment.";
        this.rejectingPaymentError = msg;
        this.errorMessage = msg;
        this.cdr.markForCheck();
      },
    });
  }

  downloadReceipt(receiptNumber: string): void {
    this.candidateService.downloadReceipt(receiptNumber).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TVK-Receipt-${receiptNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err?.message || "Failed to download receipt PDF.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Candidate Account Creation & Password Reset ---

  createAccount(): void {
    if (!this.selectedCandidate) return;

    this.creatingAccount = true;
    this.accountSuccess = "";
    this.errorMessage = "";
    this.cdr.markForCheck();

    this.candidateService.createCandidateAccount(
      this.selectedCandidate.id,
      this.accountUsernameInput.trim(),
      this.accountTempPasswordInput,
      this.attachOfferLetter,
    ).subscribe({
      next: (res) => {
        this.creatingAccount = false;
        if (this.selectedCandidate) {
          this.selectedCandidate.accountCreated = true;
          this.selectedCandidate.accountUsername = res.username;
        }
        this.accountSuccess = `Portal account created for '${res.username}'! ${res.emailSent ? (res.offerLetterAttached ? 'Credentials & Offer Letter emailed to candidate.' : 'Credentials emailed to candidate.') : 'Ready for candidate login.'}`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.creatingAccount = false;
        this.errorMessage = err?.message || "Failed to create candidate portal account.";
        this.cdr.markForCheck();
      },
    });
  }

  previewOfferLetter(candidateId?: string): void {
    const id = candidateId || this.selectedCandidate?.id;
    if (!id) return;

    this.previewingOfferLetter = true;
    this.showOfferLetterPreview = true;
    this.offerLetterPreviewError = "";
    if (this.rawOfferLetterPreviewUrl && typeof window !== "undefined") {
      window.URL.revokeObjectURL(this.rawOfferLetterPreviewUrl);
      this.rawOfferLetterPreviewUrl = null;
    }
    this.offerLetterPreviewUrl = null;
    this.cdr.markForCheck();

    this.candidateService.previewOfferLetter(id, "png").subscribe({
      next: (blob) => {
        this.previewingOfferLetter = false;
        if (typeof window !== "undefined") {
          const rawUrl = window.URL.createObjectURL(blob);
          this.rawOfferLetterPreviewUrl = rawUrl;
          this.offerLetterPreviewUrl = this.sanitizer
            ? this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl)
            : rawUrl;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.previewingOfferLetter = false;
        const msg = err?.message || "Failed to load offer letter preview.";
        this.offerLetterPreviewError = msg;
        this.errorMessage = msg;
        this.cdr.markForCheck();
      },
    });
  }

  closeOfferLetterPreview(): void {
    this.showOfferLetterPreview = false;
    this.previewingOfferLetter = false;
    this.offerLetterPreviewError = "";
    if (this.rawOfferLetterPreviewUrl && typeof window !== "undefined") {
      window.URL.revokeObjectURL(this.rawOfferLetterPreviewUrl);
      this.rawOfferLetterPreviewUrl = null;
    }
    this.offerLetterPreviewUrl = null;
    this.cdr.markForCheck();
  }

  openOfferLetterInNewTab(): void {
    if (this.rawOfferLetterPreviewUrl && typeof window !== "undefined") {
      window.open(this.rawOfferLetterPreviewUrl, "_blank");
    }
  }

  downloadOfferLetter(candidateId?: string): void {
    const id = candidateId || this.selectedCandidate?.id;
    if (!id) return;

    this.downloadingOfferLetter = true;
    this.cdr.markForCheck();

    this.candidateService.downloadOfferLetter(id).subscribe({
      next: (blob) => {
        this.downloadingOfferLetter = false;
        if (typeof window !== "undefined" && typeof document !== "undefined") {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const ext = blob.type.includes("pdf") ? "pdf" : "png";
          a.download = `Offer_Letter_${id}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.downloadingOfferLetter = false;
        this.errorMessage = err?.message || "Failed to download offer letter.";
        this.cdr.markForCheck();
      },
    });
  }

  saveAndEmailCredentials(): void {
    if (!this.selectedCandidate) return;

    const username = this.accountUsernameInput.trim();
    if (!username || username.length < 3) {
      this.errorMessage = "Portal username must be at least 3 characters long.";
      this.cdr.markForCheck();
      return;
    }

    const newPassword = this.accountNewPasswordInput;
    if (!newPassword || newPassword.length < 6) {
      this.errorMessage = "New password must be at least 6 characters long.";
      this.cdr.markForCheck();
      return;
    }

    if (newPassword !== this.accountConfirmPasswordInput) {
      this.errorMessage = "Passwords do not match. Please ensure New Password and Confirm Password match exactly.";
      this.cdr.markForCheck();
      return;
    }

    this.savingCredentials = true;
    this.errorMessage = "";
    this.accountSuccess = "";
    this.cdr.markForCheck();

    this.candidateService.updateAccountCredentials(
      this.selectedCandidate.id,
      username,
      newPassword,
      this.attachOfferLetter,
    ).subscribe({
      next: (res) => {
        this.savingCredentials = false;
        if (this.selectedCandidate) {
          this.selectedCandidate.accountUsername = res.username;
          this.selectedCandidate.accountPassword = res.password || newPassword;
          this.selectedCandidate.accountCreated = true;
        }
        this.accountSuccess = res.message || `Updated credentials for '${res.username}' saved securely and ${res.offerLetterAttached ? 'emailed with Offer Letter' : 'emailed'} to candidate.`;
        this.accountNewPasswordInput = "";
        this.accountConfirmPasswordInput = "";
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingCredentials = false;
        this.errorMessage = err?.error?.error?.message || err?.message || "Failed to update candidate credentials.";
        this.cdr.markForCheck();
      },
    });
  }

  resetCandidatePassword(): void {
    if (!this.selectedCandidate) return;

    this.resettingPassword = true;
    this.cdr.markForCheck();
    this.candidateService.resetCandidatePassword(this.selectedCandidate.id).subscribe({
      next: (res) => {
        this.resettingPassword = false;
        this.accountSuccess = `Password reset successfully! ${res.emailSent ? 'Temporary credentials sent via email.' : ''}`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.resettingPassword = false;
        this.errorMessage = err?.message || "Failed to reset candidate password.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Course Completion & Certificate ---

  saveCourseCompletion(): void {
    if (!this.selectedCandidate) return;

    this.markingCompletion = true;
    this.cdr.markForCheck();
    this.candidateService.markCourseCompletion(
      this.selectedCandidate.id,
      this.courseCompletedCheck,
      this.courseCompletedCheck ? this.completionDateInput : null,
    ).subscribe({
      next: (updated) => {
        this.markingCompletion = false;
        this.selectedCandidate = { ...updated };
        this.updateCandidateInLocalLists(updated);
        this.successMessage = "Course completion status updated.";
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.markingCompletion = false;
        this.errorMessage = err?.message || "Failed to update course completion.";
        this.cdr.markForCheck();
      },
    });
  }

  generateCertificate(): void {
    if (!this.selectedCandidate) return;

    this.generatingCert = true;
    this.cdr.markForCheck();
    this.candidateService.generateCertificate(this.selectedCandidate.id, false).subscribe({
      next: (updated) => {
        this.generatingCert = false;
        this.selectedCandidate = { ...updated };
        this.updateCandidateInLocalLists(updated);
        this.successMessage = `Certificate generated successfully! ID: ${updated.certificateId}`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.generatingCert = false;
        this.errorMessage = err?.message || "Failed to generate certificate.";
        this.cdr.markForCheck();
      },
    });
  }

  revokeCandidateCertificate(): void {
    if (!this.selectedCandidate || this.selectedCandidate.certificateStatus !== "ISSUED") return;
    const reason = window.prompt("Enter official reason for revoking this certificate:", "Administrative revocation");
    if (!reason || !reason.trim()) return;

    this.candidateService.revokeCertificate(this.selectedCandidate.id, reason.trim()).subscribe({
      next: (updated) => {
        this.selectedCandidate = { ...updated };
        this.updateCandidateInLocalLists(updated);
        this.successMessage = `Certificate ${updated.certificateId} has been revoked.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err?.message || "Failed to revoke certificate.";
        this.cdr.markForCheck();
      },
    });
  }

  downloadCandidateCertificate(): void {
    if (!this.selectedCandidate || this.selectedCandidate.certificateStatus !== "ISSUED") return;

    this.downloadingCert = true;
    this.cdr.markForCheck();
    this.candidateService.downloadCertificate(this.selectedCandidate.id).subscribe({
      next: (blob) => {
        this.downloadingCert = false;
        const ext = blob.type.includes("pdf") ? "pdf" : "png";
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TVK-Certificate-${this.selectedCandidate?.certificateId || "Completion"}.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.downloadingCert = false;
        this.errorMessage = err?.message || "Failed to download certificate.";
        this.cdr.markForCheck();
      },
    });
  }

  previewCertificate(): void {
    if (!this.selectedCandidate || this.selectedCandidate.certificateStatus !== "ISSUED") return;

    this.closePreview();
    this.candidateService.previewCertificate(this.selectedCandidate.id).subscribe({
      next: (blob) => {
        const rawUrl = window.URL.createObjectURL(blob);
        this.rawPreviewPdfUrl = rawUrl;
        this.previewPdfUrl = this.sanitizer
          ? this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl)
          : rawUrl;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err?.message || "Failed to load certificate preview.";
        this.cdr.markForCheck();
      },
    });
  }

  closePreview(): void {
    if (this.rawPreviewPdfUrl) {
      window.URL.revokeObjectURL(this.rawPreviewPdfUrl);
      this.rawPreviewPdfUrl = null;
    }
    this.previewPdfUrl = null;
    this.cdr.markForCheck();
  }

  // --- Outbound Add Candidate Form ---

  openAddOutboundModal(): void {
    this.showOutboundModal = true;
    this.outboundEntryMethod = null;
    this.errorMessage = "";
    this.outboundName = "";
    this.outboundEmail = "";
    this.outboundPhone = "";
    this.outboundPosition = "";
    this.outboundExperience = "";
    this.outboundLocation = "";
    this.outboundSkills = "";
    this.outboundNotes = "";
    this.outboundResumeFile = null;
    this.outboundFileError = "";
    this.cdr.markForCheck();
  }

  selectOutboundEntryMethod(method: "MANUAL_TYPING" | "RECEIVED_FROM_EMAIL"): void {
    this.outboundEntryMethod = method;
    this.outboundFileError = "";
    if (method === "MANUAL_TYPING") this.outboundResumeFile = null;
    this.cdr.markForCheck();
  }

  changeOutboundEntryMethod(): void {
    this.outboundEntryMethod = null;
    this.outboundFileError = "";
    this.errorMessage = "";
    this.cdr.markForCheck();
  }

  closeAddOutboundModal(): void {
    if (this.savingOutbound) return;
    this.showOutboundModal = false;
    this.outboundEntryMethod = null;
    this.cdr.markForCheck();
  }

  onOutboundResumeSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.outboundFileError = "";
    if (!input.files || input.files.length === 0) {
      this.outboundResumeFile = null;
      return;
    }

    const file = input.files[0];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".doc", ".docx"].includes(ext)) {
      this.outboundFileError = "Only PDF, DOC, and DOCX files are allowed.";
      input.value = "";
      this.outboundResumeFile = null;
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      this.outboundFileError = "Resume file size must not exceed 1 MB.";
      input.value = "";
      this.outboundResumeFile = null;
      return;
    }

    this.outboundResumeFile = file;
    this.outboundFileError = "";
    this.cdr.markForCheck();
  }

  submitOutboundCandidate(): void {
    if (this.savingOutbound) return;
    this.errorMessage = "";
    if (!this.outboundEntryMethod) {
      this.errorMessage = "Choose how this external resume was received.";
      return;
    }

    if (!this.outboundName.trim() || !this.outboundEmail.trim() || !this.outboundPhone.trim() || !this.outboundPosition.trim()) {
      this.errorMessage = "Please fill in all required fields (Name, Email, Phone, Position/Course).";
      this.cdr.markForCheck();
      return;
    }

    if (this.outboundEntryMethod === "RECEIVED_FROM_EMAIL" && !this.outboundResumeFile) {
      this.outboundFileError = "Attach the resume received by email.";
      this.cdr.markForCheck();
      return;
    }

    this.savingOutbound = true;
    this.errorMessage = "";
    this.cdr.markForCheck();

    const formData = new FormData();
    formData.append("name", this.outboundName.trim());
    formData.append("email", this.outboundEmail.trim());
    formData.append("phone", this.outboundPhone.trim());
    formData.append("position", this.outboundPosition.trim());
    formData.append("experience", this.outboundExperience.trim());
    formData.append("location", this.outboundLocation.trim());
    formData.append("skills", this.outboundSkills.trim());
    formData.append("notes", this.outboundNotes.trim());
    formData.append("entryMethod", this.outboundEntryMethod);
    if (this.outboundResumeFile) {
      formData.append("resume", this.outboundResumeFile, this.outboundResumeFile.name);
    }

    this.candidateService.createOutbound(formData).subscribe({
      next: (created) => {
        this.savingOutbound = false;
        this.showOutboundModal = false;

        this.outboundName = "";
        this.outboundEmail = "";
        this.outboundPhone = "";
        this.outboundPosition = "";
        this.outboundExperience = "";
        this.outboundLocation = "";
        this.outboundSkills = "";
        this.outboundNotes = "";
        this.outboundResumeFile = null;
        this.outboundEntryMethod = null;
        this.outboundFileError = "";

        // Add created candidate to outbound list immediately, even if assignedToId is null
        const alreadyListed = this.outboundCandidates.some((candidate) => candidate.id === created.id);
        this.outboundCandidates = [created, ...this.outboundCandidates.filter((c) => c.id !== created.id)];
        if (!alreadyListed) {
          this.setOutboundTotalCount(this.outboundTotalCount + 1);
        }

        // Ensure newly registered unassigned candidate is visible under active filter
        if (this.outboundAssignmentFilter === "ASSIGNED") {
          this.outboundAssignmentFilter = "ALL";
        }
        if (this.outboundHrFilter !== "ALL") {
          this.outboundHrFilter = "ALL";
        }
        this.applyOutboundFilter();

        if (created.assignedToId) {
          this.successMessage = `Outbound candidate '${created.name}' added successfully!`;
        } else {
          this.successMessage = `Outbound candidate '${created.name}' registered successfully and routed to Admin for HR assignment.`;
        }

        // Also refresh list from backend to guarantee complete sync
        this.loadOutboundCandidates();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingOutbound = false;
        this.errorMessage = err?.message || "Failed to add outbound candidate.";
        this.cdr.markForCheck();
      },
    });
  }

  private updateCandidateInLocalLists(updated: Candidate): void {
    this.inboundCandidates = this.inboundCandidates.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
    this.applyInboundFilter();

    this.outboundCandidates = this.outboundCandidates.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
    this.applyOutboundFilter();
  }
}
