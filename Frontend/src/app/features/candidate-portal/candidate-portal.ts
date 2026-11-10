import { ChangeDetectorRef, Component, OnDestroy, OnInit, Optional, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { Candidate } from "../../core/models/candidate.model";
import { CandidatePortalService } from "../../core/services/candidate-portal.service";
import { TrainerService } from "../../core/services/trainer.service";

@Component({
  selector: "app-candidate-portal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./candidate-portal.html",
  styleUrl: "./candidate-portal.css",
})
export class CandidatePortalComponent implements OnInit, OnDestroy {
  private readonly portalService: CandidatePortalService;
  private readonly router: Router;
  private readonly route: ActivatedRoute;
  private readonly cdr: ChangeDetectorRef;
  private readonly sanitizer: DomSanitizer;
  private readonly trainerService?: TrainerService;

  // Authenticated state
  isAuthenticated = false;
  loadingDetails = true;
  candidate: Candidate | null = null;
  activeTab: "DETAILS" | "COURSE" | "PAYMENTS" | "CERTIFICATE" = "DETAILS";
  mobileMenuOpen = false;

  // Live Batch & Meeting info
  activeBatch: any = null;

  // Trainer Rating & Student Feedback Modal
  showFeedbackModal = false;
  feedbackRating = 5;
  feedbackComment = "";
  submittingFeedback = false;

  // Actions & feedback
  actionError = "";
  actionSuccess = "";

  // Resume Download Action
  downloadingResume = false;

  // Correction Request Modal
  showCorrectionModal = false;
  correctionText = "";
  submittingCorrection = false;

  // Make Payment / Submit Proof Form
  showPaymentModal = false;
  payAmount = 0;
  payTransactionRef = "";
  payNotes = "";
  payProofFile: File | null = null;
  submittingPayment = false;
  paymentFileError = "";

  // Certificate & Receipt Actions
  downloadingCert = false;
  previewingCert = false;
  previewIsImage = false;
  previewPdfUrl: SafeResourceUrl | null = null;
  private rawPreviewPdfUrl: string | null = null;
  downloadingReceiptNum = "";

  // Course Curriculum State
  curriculumInfo: {
    available: boolean;
    courseName: string;
    courseId?: string;
    duration?: string;
    fees?: number;
    fileId?: string;
    curriculumFileName?: string;
    curriculumFileType?: string;
    curriculumFileSize?: number;
    curriculumUploadedAt?: string | null;
  } | null = null;
  loadingCurriculum = false;
  downloadingCurriculum = false;

  constructor(
    @Optional() portalService?: CandidatePortalService,
    @Optional() router?: Router,
    @Optional() route?: ActivatedRoute,
    @Optional() cdr?: ChangeDetectorRef,
    @Optional() sanitizer?: DomSanitizer,
    @Optional() trainerService?: TrainerService,
  ) {
    let resolvedCdr = cdr;
    if (!resolvedCdr) {
      try {
        resolvedCdr = inject(ChangeDetectorRef);
      } catch {
        resolvedCdr = { markForCheck: () => {}, detectChanges: () => {} } as unknown as ChangeDetectorRef;
      }
    }
    this.cdr = resolvedCdr;

    let resolvedSanitizer = sanitizer;
    if (!resolvedSanitizer) {
      try {
        resolvedSanitizer = inject(DomSanitizer);
      } catch {
        resolvedSanitizer = {
          bypassSecurityTrustResourceUrl: (val: string) => val as unknown as SafeResourceUrl,
        } as unknown as DomSanitizer;
      }
    }
    this.sanitizer = resolvedSanitizer;
    this.cdr = resolvedCdr;

    let resolvedPortal = portalService;
    if (!resolvedPortal) {
      try {
        resolvedPortal = inject(CandidatePortalService);
      } catch {
        // unit tests pass mock
      }
    }
    this.portalService = resolvedPortal!;

    let resolvedRouter = router;
    if (!resolvedRouter) {
      try {
        resolvedRouter = inject(Router);
      } catch {
        // unit tests pass mock
      }
    }
    this.router = resolvedRouter!;

    let resolvedRoute = route;
    if (!resolvedRoute) {
      try {
        resolvedRoute = inject(ActivatedRoute);
      } catch {
        // unit tests pass mock
      }
    }
    this.route = resolvedRoute!;

    let resolvedTrainerService = trainerService;
    if (!resolvedTrainerService) {
      try {
        resolvedTrainerService = inject(TrainerService);
      } catch {
        // Optional
      }
    }
    this.trainerService = resolvedTrainerService;
  }

  ngOnInit(): void {
    if (!this.portalService.isLoggedIn()) {
      void this.router.navigateByUrl("/candidate-login");
      return;
    }

    this.fetchMyDetails();
  }

  fetchMyDetails(): void {
    this.loadingDetails = true;
    this.actionError = "";
    this.cdr.markForCheck();

    this.portalService.getMyDetails().subscribe({
      next: (cand) => {
        this.candidate = cand;
        this.isAuthenticated = true;
        this.loadingDetails = false;
        if (cand.balance && cand.balance > 0) {
          this.payAmount = cand.balance;
        }
        this.fetchCurriculum();
        this.loadCandidateBatch();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingDetails = false;
        this.portalService.clearToken();
        this.isAuthenticated = false;
        this.cdr.markForCheck();
        void this.router.navigateByUrl("/candidate-login");
      },
    });
  }

  switchTab(tab: "DETAILS" | "COURSE" | "PAYMENTS" | "CERTIFICATE"): void {
    this.activeTab = tab;
    this.actionError = "";
    this.actionSuccess = "";
    this.closeMobileMenu();
    if (tab === "COURSE") {
      this.fetchCurriculum();
    }
    this.cdr.markForCheck();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.cdr.markForCheck();
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.closePreview();
  }

  logout(): void {
    this.closeMobileMenu();
    this.closePreview();
    this.portalService.clearToken();
    this.isAuthenticated = false;
    this.candidate = null;
    this.cdr.markForCheck();
    void this.router.navigateByUrl("/candidate-login");
  }

  // --- Request Correction ---

  openCorrectionModal(): void {
    this.showCorrectionModal = true;
    this.correctionText = "";
    this.actionError = "";
    this.actionSuccess = "";
    this.cdr.markForCheck();
  }

  closeCorrectionModal(): void {
    this.showCorrectionModal = false;
    this.cdr.markForCheck();
  }

  submitCorrection(): void {
    if (!this.correctionText.trim()) {
      this.actionError = "Please describe the changes or corrections needed.";
      this.cdr.markForCheck();
      return;
    }

    this.submittingCorrection = true;
    this.actionError = "";
    this.cdr.markForCheck();

    this.portalService.submitCorrectionRequest(this.correctionText.trim()).subscribe({
      next: (res) => {
        this.submittingCorrection = false;
        this.showCorrectionModal = false;
        this.actionSuccess = res.message || "Correction request submitted to HR successfully.";
        this.cdr.markForCheck();
        this.fetchMyDetails();
      },
      error: (err) => {
        this.submittingCorrection = false;
        this.actionError = err?.error?.error?.message || err?.message || "Failed to submit correction request.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Installment Payment Proof Submission ---

  openPaymentModal(): void {
    this.showPaymentModal = true;
    this.payAmount = this.candidate?.balance || 0;
    this.payTransactionRef = "";
    this.payNotes = "";
    this.payProofFile = null;
    this.paymentFileError = "";
    this.actionError = "";
    this.actionSuccess = "";
    this.cdr.markForCheck();
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.cdr.markForCheck();
  }

  onProofFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.paymentFileError = "";
    if (!input.files || input.files.length === 0) {
      this.payProofFile = null;
      this.cdr.markForCheck();
      return;
    }

    const file = input.files[0];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".pdf"].includes(ext)) {
      this.paymentFileError = "Only PNG, JPG, JPEG, and PDF files are allowed.";
      input.value = "";
      this.payProofFile = null;
      this.cdr.markForCheck();
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.paymentFileError = "File size must not exceed 2 MB.";
      input.value = "";
      this.payProofFile = null;
      this.cdr.markForCheck();
      return;
    }

    this.payProofFile = file;
    this.cdr.markForCheck();
  }

  submitPaymentProof(): void {
    if (!this.payTransactionRef.trim()) {
      this.actionError = "Transaction Reference / UTR Number is required.";
      this.cdr.markForCheck();
      return;
    }

    if (!this.payProofFile) {
      this.actionError = "Please upload payment proof screenshot or receipt.";
      this.cdr.markForCheck();
      return;
    }

    this.submittingPayment = true;
    this.actionError = "";
    this.cdr.markForCheck();

    const formData = new FormData();
    formData.append("transactionRef", this.payTransactionRef.trim());
    formData.append("amount", String(this.payAmount || 0));
    formData.append("notes", this.payNotes.trim());
    formData.append("proof", this.payProofFile, this.payProofFile.name);

    this.portalService.submitPayment(formData).subscribe({
      next: () => {
        this.submittingPayment = false;
        this.showPaymentModal = false;
        this.actionSuccess = "Payment proof submitted successfully! HR will verify your transaction shortly.";
        this.cdr.markForCheck();
        this.fetchMyDetails();
      },
      error: (err) => {
        this.submittingPayment = false;
        this.actionError = err?.error?.error?.message || err?.message || "Failed to submit payment proof.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Official Receipt Download ---

  downloadReceipt(receiptNumber: string): void {
    if (!receiptNumber) return;
    this.downloadingReceiptNum = receiptNumber;
    this.cdr.markForCheck();

    this.portalService.downloadReceipt(receiptNumber).subscribe({
      next: (blob) => {
        this.downloadingReceiptNum = "";
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TVK-Receipt-${receiptNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.downloadingReceiptNum = "";
        this.actionError = err?.message || "Failed to download receipt.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Resume Document Download ---

  downloadResume(): void {
    if (!this.candidate?.resumeFileId) return;

    this.downloadingResume = true;
    this.actionError = "";
    this.cdr.markForCheck();

    this.portalService.downloadMyResume(this.candidate.resumeFileId).subscribe({
      next: (blob) => {
        this.downloadingResume = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = this.candidate?.resumeName || "TVK-Resume.pdf";
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.downloadingResume = false;
        this.actionError = err?.error?.error?.message || err?.message || "Failed to download resume.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Course Curriculum Actions ---

  fetchCurriculum(): void {
    this.loadingCurriculum = true;
    this.cdr.markForCheck();

    this.portalService.getCurriculum().subscribe({
      next: (info) => {
        this.curriculumInfo = info;
        this.loadingCurriculum = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.curriculumInfo = null;
        this.loadingCurriculum = false;
        this.cdr.markForCheck();
      },
    });
  }

  downloadCurriculum(): void {
    if (!this.curriculumInfo?.available) return;

    this.downloadingCurriculum = true;
    this.actionError = "";
    this.cdr.markForCheck();

    this.portalService.downloadCurriculum().subscribe({
      next: (blob) => {
        this.downloadingCurriculum = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = this.curriculumInfo?.curriculumFileName || `${this.candidate?.courseName || "Course"}-Curriculum.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.downloadingCurriculum = false;
        this.actionError = err?.error?.error?.message || err?.message || "Failed to download course curriculum.";
        this.cdr.markForCheck();
      },
    });
  }

  formatCurriculumSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // --- Certificate Actions ---

  downloadCertificate(): void {
    if (!this.candidate || this.candidate.certificateStatus !== "ISSUED") return;

    this.downloadingCert = true;
    this.actionError = "";
    this.cdr.markForCheck();

    this.portalService.downloadCertificate("png").subscribe({
      next: (blob) => {
        this.downloadingCert = false;
        const ext = blob.type.includes("pdf") ? "pdf" : "png";
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TVK-Certificate-${this.candidate?.certificateId || "Completion"}.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.downloadingCert = false;
        this.actionError = err?.message || "Failed to download certificate.";
        this.cdr.markForCheck();
      },
    });
  }

  previewCertificate(): void {
    if (!this.candidate || this.candidate.certificateStatus !== "ISSUED") return;

    // Revoke any existing preview blob URL before creating a new one
    this.closePreview();

    this.previewingCert = true;
    this.previewIsImage = true;
    this.actionError = "";
    this.cdr.markForCheck();

    this.portalService.downloadCertificate("png").subscribe({
      next: (blob) => {
        this.previewingCert = false;
        this.previewIsImage = true;
        this.rawPreviewPdfUrl = window.URL.createObjectURL(blob);
        this.previewPdfUrl = this.sanitizer?.bypassSecurityTrustResourceUrl
          ? this.sanitizer.bypassSecurityTrustResourceUrl(this.rawPreviewPdfUrl)
          : (this.rawPreviewPdfUrl as unknown as SafeResourceUrl);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.previewingCert = false;
        this.actionError = err?.message || "Failed to load certificate preview.";
        this.cdr.markForCheck();
      },
    });
  }

  closePreview(): void {
    if (this.rawPreviewPdfUrl) {
      window.URL.revokeObjectURL(this.rawPreviewPdfUrl);
      this.rawPreviewPdfUrl = null;
    }
    if (this.previewPdfUrl) {
      this.previewPdfUrl = null;
    }
    this.cdr.markForCheck();
  }

  getTaskStatusClass(status: string): string {
    return (status || "").toLowerCase().trim().replace(/\s+/g, "-");
  }

  // --- Live Batch & Trainer Feedback ---

  async loadCandidateBatch(): Promise<void> {
    if (!this.trainerService || !this.candidate) return;
    try {
      const batches = await this.trainerService.getBatches({ status: "ACTIVE" });
      const normCourse = (this.candidate.courseName || "").toLowerCase();
      this.activeBatch =
        batches.find(
          (b) =>
            (this.candidate?.trainerId && b.trainerId === this.candidate.trainerId) ||
            (normCourse && b.courseName.toLowerCase() === normCourse)
        ) || null;
      this.cdr.markForCheck();
    } catch {
      // Non-blocking
    }
  }

  openFeedbackModal(): void {
    this.showFeedbackModal = true;
    this.feedbackRating = 5;
    this.feedbackComment = "";
    this.actionError = "";
    this.actionSuccess = "";
    this.cdr.markForCheck();
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.cdr.markForCheck();
  }

  setFeedbackRating(rating: number): void {
    this.feedbackRating = rating;
    this.cdr.markForCheck();
  }

  async submitTrainerFeedback(): Promise<void> {
    if (!this.candidate?.trainerId || !this.trainerService) {
      this.actionError = "Assigned instructor details not found for feedback.";
      this.cdr.markForCheck();
      return;
    }

    this.submittingFeedback = true;
    this.actionError = "";
    this.cdr.markForCheck();

    try {
      await this.trainerService.submitTrainerFeedback({
        trainerId: this.candidate.trainerId,
        studentId: this.candidate.id,
        studentName: this.candidate.name,
        courseName: this.candidate.courseName || "Training Course",
        rating: this.feedbackRating,
        feedback: this.feedbackComment.trim() || "Good training experience",
      });

      this.submittingFeedback = false;
      this.showFeedbackModal = false;
      this.actionSuccess = "Thank you! Your feedback for the instructor has been submitted successfully.";
      this.cdr.markForCheck();
    } catch (err: any) {
      this.submittingFeedback = false;
      this.actionError = err?.error?.message || err?.message || "Failed to submit trainer feedback.";
      this.cdr.markForCheck();
    }
  }
}
