import { ChangeDetectorRef, Component, OnDestroy, OnInit, Optional, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PaymentRecord } from "../../core/models/candidate.model";
import { CandidateService } from "../../core/services/candidate.service";
import { ApiPage } from "../../core/services/api.service";
import { AuthService } from "../../core/services/auth.service";
import { firstValueFrom } from "rxjs";

@Component({
  selector: "app-payments",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./payments.html",
  styleUrl: "./payments.css",
})
export class PaymentsComponent implements OnInit, OnDestroy {
  private readonly candidateService: CandidateService;
  private readonly cdr: ChangeDetectorRef;
  private readonly authService?: AuthService;
  private readonly route?: ActivatedRoute;

  payments: PaymentRecord[] = [];
  filteredPayments: PaymentRecord[] = [];
  loading = true;
  refreshing = false;
  lastRefreshedAt: Date | null = null;
  errorMessage = "";
  successMessage = "";
  private autoRefreshTimer: any = null;
  private focusHandler?: () => void;

  searchQuery = "";
  statusFilter = "ALL";

  // Navigation tab: Transactions vs Official Payment QR Controls
  activeTab: "TRANSACTIONS" | "QR_CONTROLS" = "TRANSACTIONS";

  // Official Shared Payment QR Controls
  commonPaymentQr = "";
  loadingCommonQr = false;
  uploadingCommonQr = false;
  commonQrSuccess = "";
  commonQrError = "";

  get canManagePaymentQr(): boolean {
    return this.authService?.role === "MANAGER";
  }

  // Verification modal
  verifyingPayment: PaymentRecord | null = null;
  verifiedAmountInput = 0;
  verificationNotes = "";
  submittingVerification = false;
  verifyingPaymentError = "";

  // Rejection modal
  rejectingPayment: PaymentRecord | null = null;
  rejectionReasonInput = "";
  submittingRejection = false;
  rejectingPaymentError = "";

  // Downloading
  downloadingReceiptNum = "";
  selectedPaymentQr: PaymentRecord | null = null;

  get canManagePayments(): boolean {
    return this.authService?.role === "MANAGER";
  }

  constructor(
    @Optional() candidateService?: CandidateService,
    @Optional() cdr?: ChangeDetectorRef,
    @Optional() authService?: AuthService,
    @Optional() route?: ActivatedRoute,
  ) {
    this.authService = authService;
    this.route = route;
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
  }

  ngOnInit(): void {
    this.loadPayments();

    // Auto-refresh payment transactions every 12 seconds in the background
    this.autoRefreshTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        if (this.activeTab === "TRANSACTIONS") {
          void this.loadPayments(true);
        }
      }
    }, 12000);

    if (typeof window !== "undefined") {
      this.focusHandler = () => {
        if (this.activeTab === "TRANSACTIONS") {
          void this.loadPayments(true);
        }
      };
      window.addEventListener("focus", this.focusHandler);
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

  switchTab(tab: "TRANSACTIONS" | "QR_CONTROLS"): void {
    this.activeTab = tab;
    this.errorMessage = "";
    this.successMessage = "";
    this.commonQrSuccess = "";
    this.commonQrError = "";
    if (tab === "QR_CONTROLS") {
      this.loadCommonPaymentQr();
    }
    this.cdr.markForCheck();
  }

  loadCommonPaymentQr(): void {
    this.loadingCommonQr = true;
    this.candidateService.getCommonPaymentQr().subscribe({
      next: (res) => {
        this.commonPaymentQr = res?.qrCode || "";
        this.loadingCommonQr = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingCommonQr = false;
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
    if (file.size > 2 * 1024 * 1024) {
      this.commonQrError = "QR Code image size must be under 2MB.";
      return;
    }

    this.uploadingCommonQr = true;
    this.commonQrError = "";
    this.commonQrSuccess = "";
    this.cdr.markForCheck();

    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => {
        const localDataUrl = reader.result as string;
        this.commonPaymentQr = localDataUrl;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }

    this.candidateService.uploadCommonPaymentQr(file).subscribe({
      next: (res) => {
        const finalQr = res.qrCode || this.commonPaymentQr;
        this.commonPaymentQr = finalQr;
        this.uploadingCommonQr = false;
        this.commonQrSuccess = "Official payment QR code uploaded successfully and synchronized across candidate portals!";
        this.cdr.markForCheck();
        input.value = "";
      },
      error: (err) => {
        this.uploadingCommonQr = false;
        this.commonQrError = err.error?.message || "Failed to upload official payment QR code.";
        this.cdr.markForCheck();
        input.value = "";
      },
    });
  }

  async loadPayments(silent = false): Promise<void> {
    if (!silent) {
      this.loading = true;
    } else {
      this.refreshing = true;
    }
    this.errorMessage = "";
    this.cdr.markForCheck();

    try {
      const pageSize = 100;
      const firstPage = await firstValueFrom(this.candidateService.getAllPayments({ page: 1, pageSize }));
      const pageCount = firstPage.pagination?.pageCount || 1;
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
          firstValueFrom(this.candidateService.getAllPayments({ page: index + 2, pageSize })),
        ),
      );
      this.payments = [
        ...(firstPage.items || []),
        ...remainingPages.flatMap((response: ApiPage<PaymentRecord>) => response.items || []),
      ];
      this.applyFilter();
      this.lastRefreshedAt = new Date();
    } catch (err) {
      if (!silent) {
        this.errorMessage = (err as Error)?.message || "Failed to load payment transactions.";
      }
    } finally {
      this.loading = false;
      this.refreshing = false;
      this.cdr.markForCheck();
    }
  }

  applyFilter(): void {
    let list = [...this.payments];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.candidateName.toLowerCase().includes(q) ||
          (p.candidateEmail || "").toLowerCase().includes(q) ||
          (p.candidatePhone || "").toLowerCase().includes(q) ||
          p.courseName.toLowerCase().includes(q) ||
          p.transactionRef.toLowerCase().includes(q) ||
          (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q)),
      );
    }

    if (this.statusFilter !== "ALL") {
      list = list.filter((p) => p.status === this.statusFilter);
    }

    this.filteredPayments = list;
    this.cdr.markForCheck();
  }

  openVerifyModal(payment: PaymentRecord): void {
    if (!this.canManagePayments) return;
    this.verifyingPayment = payment;
    this.verifiedAmountInput = Number(payment.amount) || 0;
    this.verificationNotes = "";
    this.verifyingPaymentError = "";
    this.errorMessage = "";
    this.successMessage = "";
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

    const paymentId = this.verifyingPayment.id || (this.verifyingPayment as any)._id;
    const candidateId = this.verifyingPayment.candidateId;

    if (!candidateId || !paymentId) {
      this.verifyingPaymentError = "Missing candidate or payment identification.";
      this.cdr.markForCheck();
      return;
    }

    const verifiedAmount = Number(this.verifiedAmountInput);
    if (!verifiedAmount || verifiedAmount <= 0) {
      this.verifyingPaymentError = "Please enter a valid amount greater than zero.";
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
        this.successMessage = `Payment of ₹${res.payment.amount} verified! Receipt ${res.payment.receiptNumber || ''} generated successfully.`;
        this.cdr.markForCheck();
        this.loadPayments();
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
    this.errorMessage = "";
    this.successMessage = "";
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

    const paymentId = this.rejectingPayment.id || (this.rejectingPayment as any)._id;
    const candidateId = this.rejectingPayment.candidateId;

    if (!candidateId || !paymentId) {
      this.rejectingPaymentError = "Missing candidate or payment identification.";
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
      next: () => {
        this.submittingRejection = false;
        this.rejectingPayment = null;
        this.rejectingPaymentError = "";
        this.successMessage = "Payment submission has been rejected.";
        this.cdr.markForCheck();
        this.loadPayments();
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
    if (!receiptNumber) return;
    this.downloadingReceiptNum = receiptNumber;
    this.cdr.markForCheck();

    this.candidateService.downloadReceipt(receiptNumber).subscribe({
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
        this.errorMessage = err?.message || "Failed to download receipt.";
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

  openPaymentQr(payment: PaymentRecord): void {
    if (payment.paymentQrCode) this.selectedPaymentQr = payment;
  }

  closePaymentQr(): void {
    this.selectedPaymentQr = null;
  }
}
