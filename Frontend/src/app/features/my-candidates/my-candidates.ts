import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import {
  Candidate,
  CandidateStatus,
} from "../../core/models/candidate.model";
import {
  EMAIL_TEMPLATE_OPTIONS,
  EmailTemplateKey,
  generateEmailTemplate,
} from "../../core/models/email-template.model";
import {
  WHATSAPP_TEMPLATE_OPTIONS,
  WhatsAppTemplateKey,
  generateWhatsAppTemplate,
} from "../../core/models/whatsapp-template.model";
import { CandidateService } from "../../core/services/candidate.service";
import { AuthService } from "../../core/services/auth.service";
import { ResumeStorageService } from "../../core/services/resume-storage.service";

type CandidateSortKey = "name" | "email" | "phone" | "status";

@Component({
  selector: "app-my-candidates",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: "./my-candidates.html",
  styleUrl: "./my-candidates.css",
})
export class MyCandidatesComponent implements OnInit, OnDestroy {
  candidates: Candidate[] = [];
  filteredCandidates: Candidate[] = [];
  sortedCandidates: Candidate[] = [];
  loading = true;
  refreshing = false;
  lastRefreshedAt: Date | null = null;
  error = "";
  resumeLoadingId = "";
  resumeError = "";
  statusError = "";
  private autoRefreshTimer: any = null;
  private readonly subscriptions = new Subscription();
  statusSavingId = "";
  expandedCandidateId = "";
  whatsAppCandidate: Candidate | null = null;
  whatsAppMessage = "";
  whatsAppTemplateKey: WhatsAppTemplateKey = "APPLICATION_UPDATE";
  whatsAppSending = false;
  whatsAppError = "";
  whatsAppSuccess = "";
  whatsAppConfigured = false;
  whatsAppDetails: { configured: boolean; phoneId: string | null; displayPhone?: string | null; fullPhoneId?: string | null } | null = null;
  readonly whatsAppTemplateOptions = WHATSAPP_TEMPLATE_OPTIONS;
  emailCandidate: Candidate | null = null;
  emailSubject = "";
  emailMessage = "";
  emailTemplateKey: EmailTemplateKey = "APPLICATION_UPDATE";
  emailSending = false;
  emailError = "";
  emailSuccess = "";
  smtpConfigured = false;
  smtpDetails: { host: string | null; user: string | null; from: string | null } | null = null;
  readonly emailTemplateOptions = EMAIL_TEMPLATE_OPTIONS;
  readonly pageSize = 50;
  currentPage = 1;

  status: CandidateStatus | "ALL" = "ALL";
  search = "";
  sortKey: CandidateSortKey = "name";
  sortDirection: "asc" | "desc" = "asc";

  readonly statuses: CandidateStatus[] = [
    "NEW",
    "ASSIGNED",
    "CONTACT_PENDING",
    "CALLED",
    "NO_RESPONSE",
    "CALL_BACK",
    "INTERESTED",
    "NOT_INTERESTED",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "SELECTED",
    "REJECTED",
    "ON_HOLD",
    "ARCHIVED",
  ];

  constructor(
    private candidateService: CandidateService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private resumeStorage: ResumeStorageService,
  ) {
    this.subscriptions.add(
      this.candidateService.candidates$.subscribe(
        (candidates) => {
          this.candidates = candidates;
          this.lastRefreshedAt = new Date();
          this.refreshFilteredCandidates();
        },
      ),
    );
  }

  ngOnInit(): void {
    void this.loadCandidates(true);

    // Auto-refresh assigned candidates every 10 seconds in the background
    this.autoRefreshTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void this.loadCandidates(true, true);
      }
    }, 10000);

    if (typeof window !== "undefined") {
      const onFocus = () => {
        void this.loadCandidates(true, true);
      };
      window.addEventListener("focus", onFocus);
      this.subscriptions.add({
        unsubscribe: () => window.removeEventListener("focus", onFocus),
      });
    }
  }

  async loadCandidates(force = false, silent = false): Promise<void> {
    this.error = "";
    if (!silent) {
      if (!this.candidates.length) {
        this.loading = true;
      } else {
        this.refreshing = true;
      }
    } else {
      this.refreshing = true;
    }

    try {
      await this.candidateService.loadFromBackend(force);
      this.lastRefreshedAt = new Date();
    } catch (error: unknown) {
      if (!silent) {
        this.error = error instanceof Error ? error.message : "Unable to load assigned candidates.";
      }
    } finally {
      this.loading = false;
      this.refreshing = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
    this.subscriptions.unsubscribe();
  }

  refreshFilteredCandidates(resetPage = false): void {
    const query = this.search.trim().toLowerCase();
    this.filteredCandidates = this.candidates.filter((candidate) => {
      const matchesStatus = this.status === "ALL" || candidate.status === this.status;
      const matchesSearch = !query || [
        candidate.name,
        candidate.phone,
        candidate.email,
        candidate.position,
      ].join(" ").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
    this.sortCandidates();

    if (resetPage) {
      this.currentPage = 1;
      this.expandedCandidateId = "";
    } else if (this.currentPage > this.pageCount) {
      this.currentPage = this.pageCount;
    }
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredCandidates.length / this.pageSize));
  }

  get visibleCandidates(): Candidate[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedCandidates.slice(start, start + this.pageSize);
  }

  private sortCandidates(): void {
    const direction = this.sortDirection === "asc" ? 1 : -1;
    this.sortedCandidates = [...this.filteredCandidates].sort((left, right) =>
      left[this.sortKey].localeCompare(right[this.sortKey], undefined, {
        sensitivity: "base",
        numeric: true,
      }) * direction,
    );
  }

  get firstVisibleIndex(): number {
    return this.filteredCandidates.length ? (this.currentPage - 1) * this.pageSize + 1 : 0;
  }

  get lastVisibleIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredCandidates.length);
  }

  setPage(page: number): void {
    this.currentPage = Math.min(Math.max(1, page), this.pageCount);
    this.expandedCandidateId = "";
  }

  trackByCandidateId(_index: number, candidate: Candidate): string {
    return candidate.id;
  }

  toggleDetails(candidateId: string): void {
    this.expandedCandidateId = this.expandedCandidateId === candidateId ? "" : candidateId;
  }

  sortBy(key: CandidateSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = key;
      this.sortDirection = "asc";
    }
    this.sortCandidates();
  }

  async quickStatus(
    candidate: Candidate,
    status: CandidateStatus,
  ): Promise<void> {
    const employee = this.auth.user;
    if (!employee || candidate.status === status) return;

    const previousStatus = candidate.status;
    this.statusSavingId = candidate.id;
    this.statusError = "";
    try {
      await this.candidateService.updateStatus(
        candidate.id,
        status,
        `Status changed from ${this.label(previousStatus)} to ${this.label(status)} by ${employee.name}`,
        employee.name,
      );
    } catch (error: unknown) {
      this.statusError = error instanceof Error ? error.message : "Unable to update candidate status.";
    } finally {
      this.statusSavingId = "";
      this.cdr.markForCheck();
    }
  }

  openEmail(candidate: Candidate): void {
    if (!candidate.email) return;
    this.emailCandidate = candidate;
    this.emailError = "";
    this.emailSuccess = "";
    this.emailSending = false;
    this.emailTemplateKey = "APPLICATION_UPDATE";
    this.applyEmailTemplate();

    this.candidateService.getEmailStatus().then((status) => {
      this.smtpConfigured = status.configured;
      this.smtpDetails = status;
      this.applyEmailTemplate();
      this.cdr.markForCheck();
    }).catch(() => {
      this.smtpConfigured = false;
    });
  }

  get senderFromEmail(): string {
    return this.smtpDetails?.from || "training@tvktechs.com";
  }

  closeEmail(): void {
    this.emailCandidate = null;
    this.emailSubject = "";
    this.emailMessage = "";
    this.emailError = "";
    this.emailSuccess = "";
    this.emailSending = false;
  }

  onTemplateChange(key: EmailTemplateKey): void {
    this.emailTemplateKey = key;
    this.applyEmailTemplate();
  }

  private applyEmailTemplate(): void {
    if (!this.emailCandidate) return;
    const sender = this.auth.user;
    const template = generateEmailTemplate(
      this.emailTemplateKey,
      this.emailCandidate.name,
      this.emailCandidate.position,
      sender?.name ?? "Recruitment Team",
      this.senderFromEmail,
    );
    this.emailSubject = template.subject;
    this.emailMessage = template.message;
  }

  async sendEmail(): Promise<void> {
    if (!this.emailCandidate || !this.emailCandidate.email) return;
    const to = this.emailCandidate.email.trim();
    const subject = this.emailSubject.trim();
    const message = this.emailMessage.trim();
    if (!to || !subject || !message) {
      this.emailError = "Please fill in all email fields.";
      return;
    }

    this.emailSending = true;
    this.emailError = "";
    this.emailSuccess = "";

    try {
      await this.candidateService.sendEmail(this.emailCandidate.id, {
        to,
        subject,
        message,
      });
      this.emailSuccess = `Email sent successfully to ${to}`;
      setTimeout(() => {
        this.closeEmail();
        this.cdr.markForCheck();
      }, 1200);
    } catch (err: unknown) {
      this.emailError = err instanceof Error ? err.message : "Failed to send email. Please try again.";
    } finally {
      this.emailSending = false;
      this.cdr.markForCheck();
    }
  }

  get currentUserEmail(): string {
    return this.auth.user?.email || "";
  }

  get currentUserName(): string {
    return this.auth.user?.name || "Recruiter";
  }

  emailHref(candidate: Candidate): string {
    const subject = encodeURIComponent(`Regarding ${candidate.position || "your application"}`);
    const body = encodeURIComponent(`Hello ${candidate.name},\n\n`);
    return `mailto:${candidate.email}?subject=${subject}&body=${body}`;
  }

  openWhatsApp(candidate: Candidate): void {
    if (!candidate.phone) return;
    this.whatsAppCandidate = candidate;
    this.whatsAppError = "";
    this.whatsAppSuccess = "";
    this.whatsAppSending = false;
    this.whatsAppTemplateKey = "APPLICATION_UPDATE";
    this.applyWhatsAppTemplate();

    this.candidateService.getWhatsAppStatus().then((status) => {
      this.whatsAppConfigured = status.configured;
      this.whatsAppDetails = status;
      this.cdr.markForCheck();
    }).catch(() => {
      this.whatsAppConfigured = false;
    });
  }

  closeWhatsApp(): void {
    this.whatsAppCandidate = null;
    this.whatsAppMessage = "";
    this.whatsAppError = "";
    this.whatsAppSuccess = "";
    this.whatsAppSending = false;
  }

  onWhatsAppTemplateChange(key: WhatsAppTemplateKey): void {
    this.whatsAppTemplateKey = key;
    this.applyWhatsAppTemplate();
  }

  private applyWhatsAppTemplate(): void {
    if (!this.whatsAppCandidate) return;
    const sender = this.auth.user?.name || "Recruitment Team";
    this.whatsAppMessage = generateWhatsAppTemplate(
      this.whatsAppTemplateKey,
      this.whatsAppCandidate.name,
      this.whatsAppCandidate.position,
      sender,
    );
  }

  async sendDirectWhatsApp(): Promise<void> {
    if (!this.whatsAppCandidate || !this.whatsAppCandidate.phone) return;
    const message = this.whatsAppMessage.trim();
    if (!message) {
      this.whatsAppError = "Please enter a message to send.";
      return;
    }

    this.whatsAppSending = true;
    this.whatsAppError = "";
    this.whatsAppSuccess = "";

    try {
      await this.candidateService.sendWhatsApp(this.whatsAppCandidate.id, {
        phone: this.whatsAppCandidate.phone,
        message,
        templateKey: this.whatsAppTemplateKey,
        candidateName: this.whatsAppCandidate.name,
        candidatePosition: this.whatsAppCandidate.position,
      });
      this.whatsAppSuccess = `WhatsApp message sent successfully via Meta Cloud API!`;
      setTimeout(() => {
        this.closeWhatsApp();
        this.cdr.markForCheck();
      }, 1500);
    } catch (err: unknown) {
      this.whatsAppError = err instanceof Error ? err.message : "Failed to send WhatsApp message.";
    } finally {
      this.whatsAppSending = false;
      this.cdr.markForCheck();
    }
  }

  get whatsAppSenderDisplay(): string {
    return this.whatsAppDetails?.displayPhone || (this.whatsAppDetails?.phoneId ? `Phone ID: ${this.whatsAppDetails.phoneId}` : "Meta Cloud API");
  }

  openWhatsAppWeb(): void {
    const candidate = this.whatsAppCandidate;
    let phone = candidate?.phone.replace(/\D/g, "") || "";
    if (phone.startsWith("0") && phone.length === 11) {
      phone = phone.slice(1);
    }
    if (phone.length === 10) {
      phone = "91" + phone;
    }
    const message = this.whatsAppMessage.trim();
    if (!candidate || !phone || !message) return;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    this.closeWhatsApp();
  }

  async downloadResume(candidate: Candidate): Promise<void> {
    if (!candidate.resumeFileId && !candidate.resumeName) return;
    this.resumeLoadingId = candidate.id;
    this.resumeError = "";
    try {
      const blob = await this.resumeStorage.get(
        candidate.resumeFileId ?? "",
        candidate.resumeName,
        candidate.id,
      );
      if (!blob) throw new Error("The resume file is not available.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = candidate.resumeName || "resume.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      this.resumeError = error instanceof Error ? error.message : "Unable to download the resume.";
    } finally {
      this.resumeLoadingId = "";
      this.cdr.markForCheck();
    }
  }

  label(
    status: CandidateStatus,
  ): string {
    return status.replaceAll(
      "_",
      " ",
    );
  }
}