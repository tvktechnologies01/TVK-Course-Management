import { ChangeDetectorRef, Component, OnInit, inject, Optional } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { CandidatePortalService, PublicPaymentInfo } from "../../core/services/candidate-portal.service";

@Component({
  selector: "app-candidate-payment",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./candidate-payment.html",
  styleUrl: "./candidate-payment.css",
})
export class CandidatePaymentComponent implements OnInit {
  private readonly route: ActivatedRoute;
  private readonly portalService: CandidatePortalService;
  private readonly cdr: ChangeDetectorRef;

  constructor(
    @Optional() portalService?: CandidatePortalService,
    @Optional() route?: ActivatedRoute,
    @Optional() cdr?: ChangeDetectorRef,
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

    let resolvedPortal = portalService;
    if (!resolvedPortal) {
      try {
        resolvedPortal = inject(CandidatePortalService);
      } catch {
        // unit tests pass mock
      }
    }
    this.portalService = resolvedPortal!;

    let resolvedRoute = route;
    if (!resolvedRoute) {
      try {
        resolvedRoute = inject(ActivatedRoute);
      } catch {
        // unit tests pass mock
      }
    }
    this.route = resolvedRoute!;
  }

  token = "";
  paymentInfo: PublicPaymentInfo | null = null;
  loading = true;
  submitting = false;
  errorMessage = "";
  successMessage = "";

  // Submission Form
  transactionRef = "";
  amountToPay = 0;
  notes = "";
  selectedFile: File | null = null;
  fileError = "";

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.token = params["token"] || "";
      if (this.token) {
        this.fetchPaymentInfo();
      } else {
        this.errorMessage = "Missing or invalid payment token in URL.";
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  fetchPaymentInfo(): void {
    this.loading = true;
    this.errorMessage = "";
    this.cdr.markForCheck();

    this.portalService.getPublicPaymentDetails(this.token).subscribe({
      next: (info) => {
        this.paymentInfo = info;
        this.amountToPay = info.balance > 0 ? info.balance : info.totalFee;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.error?.message ||
          err?.message ||
          "This payment link has expired, is invalid, or has been revoked by administration.";
        this.cdr.markForCheck();
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileError = "";
    if (!input.files || input.files.length === 0) {
      this.selectedFile = null;
      this.cdr.markForCheck();
      return;
    }

    const file = input.files[0];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".pdf"].includes(ext)) {
      this.fileError = "Only PNG, JPG, JPEG, and PDF files are accepted.";
      input.value = "";
      this.selectedFile = null;
      this.cdr.markForCheck();
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.fileError = "File size must not exceed 2 MB.";
      input.value = "";
      this.selectedFile = null;
      this.cdr.markForCheck();
      return;
    }

    this.selectedFile = file;
    this.cdr.markForCheck();
  }

  submitPayment(): void {
    if (!this.transactionRef.trim()) {
      this.errorMessage = "Please enter your Transaction Reference / UTR Number.";
      this.cdr.markForCheck();
      return;
    }

    if (!this.selectedFile) {
      this.errorMessage = "Please upload your payment screenshot or proof document.";
      this.cdr.markForCheck();
      return;
    }

    this.submitting = true;
    this.errorMessage = "";
    this.successMessage = "";
    this.cdr.markForCheck();

    const formData = new FormData();
    formData.append("transactionRef", this.transactionRef.trim());
    formData.append("amount", String(this.amountToPay || 0));
    formData.append("notes", this.notes.trim());
    formData.append("proof", this.selectedFile, this.selectedFile.name);

    this.portalService.submitPublicPaymentProof(this.token, formData).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = "Your payment proof has been submitted successfully! TVK Technologies administration will verify the transaction shortly.";
        this.transactionRef = "";
        this.notes = "";
        this.selectedFile = null;
        this.cdr.markForCheck();
        this.fetchPaymentInfo();
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage =
          err?.error?.error?.message ||
          err?.message ||
          "Failed to submit payment proof. Please try again.";
        this.cdr.markForCheck();
      },
    });
  }
}
