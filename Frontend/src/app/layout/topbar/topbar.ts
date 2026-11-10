import { Component, OnInit, OnDestroy, inject, Optional, ChangeDetectorRef } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { AuthService } from "../../core/services/auth.service";
import { CandidateService } from "../../core/services/candidate.service";
import { TrainerService } from "../../core/services/trainer.service";
import { CandidateCorrectionNotification } from "../../core/models/candidate.model";
import { Subscription, interval, of, forkJoin, from, catchError, map } from "rxjs";

@Component({
  selector: "app-topbar",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./topbar.html",
  styleUrl: "./topbar.css",
})
export class TopbarComponent implements OnInit, OnDestroy {
  notifications: CandidateCorrectionNotification[] = [];
  facultyAlerts: any[] = [];
  activeNotificationTab: "ALL" | "FACULTY" | "CANDIDATES" = "ALL";
  loadingNotifications = false;
  showNotifications = false;
  private pollSub?: Subscription;

  // Selected Request for Manager Review & Resolution Modal
  selectedRequest: CandidateCorrectionNotification | null = null;
  updatingStatus = false;
  resettingPassword = false;
  creatingAccount = false;
  actionFeedback = "";
  actionError = "";

  constructor(
    readonly auth: AuthService,
    private router: Router,
    @Optional() private candidateService?: CandidateService,
    @Optional() private trainerService?: TrainerService,
    @Optional() private cdr?: ChangeDetectorRef,
  ) {
    if (!this.candidateService) {
      try {
        this.candidateService = inject(CandidateService);
      } catch {
        // unit test mock fallback
      }
    }
    if (!this.trainerService) {
      try {
        this.trainerService = inject(TrainerService);
      } catch {
        // unit test mock fallback
      }
    }
    if (!this.cdr) {
      try {
        this.cdr = inject(ChangeDetectorRef);
      } catch {
        this.cdr = { markForCheck: () => {}, detectChanges: () => {} } as unknown as ChangeDetectorRef;
      }
    }
  }

  get pendingCandidateCount(): number {
    return this.notifications.filter((n) => n.status === "Pending").length;
  }

  get pendingFacultyCount(): number {
    return this.facultyAlerts.length;
  }

  get pendingCount(): number {
    return this.pendingCandidateCount + this.pendingFacultyCount;
  }

  ngOnInit(): void {
    this.loadNotifications();
    this.pollSub = interval(15000).subscribe(() => {
      this.loadNotifications(false);
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  loadNotifications(showSpinner = true): void {
    if (showSpinner) {
      this.loadingNotifications = true;
      this.cdr?.markForCheck();
    }

    const today = new Date().toISOString().slice(0, 10);

    const candidateReq$ = this.candidateService
      ? this.candidateService.getCorrectionRequests()
      : of([]);

    const facultyAlerts$ = this.trainerService
      ? from(this.trainerService.getFacultyDailyAttendance(today)).pipe(
          map((res: any) => res?.alerts || []),
          catchError(() => of([]))
        )
      : of([]);

    forkJoin({
      candidates: candidateReq$.pipe(catchError(() => of([]))),
      faculty: facultyAlerts$,
    }).subscribe({
      next: ({ candidates, faculty }) => {
        this.notifications = candidates || [];
        this.facultyAlerts = faculty || [];
        this.loadingNotifications = false;
        this.cdr?.markForCheck();
      },
      error: () => {
        this.loadingNotifications = false;
        this.cdr?.markForCheck();
      },
    });
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotifications();
    }
    this.cdr?.markForCheck();
  }

  onFacultyAlertClick(alert: any): void {
    this.showNotifications = false;
    void this.router.navigate(["/trainer-management"]);
  }

  onNotificationClick(item: CandidateCorrectionNotification): void {
    this.selectedRequest = item;
    this.showNotifications = false;
    this.actionFeedback = "";
    this.actionError = "";
    this.cdr?.markForCheck();
  }

  closeRequestModal(): void {
    this.selectedRequest = null;
    this.actionFeedback = "";
    this.actionError = "";
    this.cdr?.markForCheck();
  }

  updateStatus(status: "Pending" | "In Progress" | "Resolved"): void {
    if (!this.selectedRequest || !this.candidateService) return;
    this.updatingStatus = true;
    this.actionFeedback = "";
    this.actionError = "";
    this.cdr?.markForCheck();

    const candidateId = this.selectedRequest.candidateId;
    const requestId = this.selectedRequest.id;

    this.candidateService.updateCorrectionRequestStatus(candidateId, requestId, status).subscribe({
      next: () => {
        this.updatingStatus = false;
        if (this.selectedRequest) {
          this.selectedRequest.status = status;
        }
        const item = this.notifications.find((n) => n.id === requestId);
        if (item) {
          item.status = status;
        }
        this.actionFeedback = `Request status updated to "${status}".`;
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.updatingStatus = false;
        this.actionError =
          err?.error?.error?.message || err?.message || "Failed to update status. Please try again.";
        this.cdr?.markForCheck();
      },
    });
  }

  resetPassword(): void {
    if (!this.selectedRequest || !this.candidateService) return;
    this.resettingPassword = true;
    this.actionFeedback = "";
    this.actionError = "";
    this.cdr?.markForCheck();

    this.candidateService.resetCandidatePassword(this.selectedRequest.candidateId).subscribe({
      next: () => {
        this.resettingPassword = false;
        this.actionFeedback = `Password has been reset securely. Login credentials were sent to ${this.selectedRequest?.email || "the candidate"}.`;
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.resettingPassword = false;
        this.actionError =
          err?.error?.error?.message || err?.message || "Failed to reset password. Please try again.";
        this.cdr?.markForCheck();
      },
    });
  }

  createAccount(): void {
    if (!this.selectedRequest || !this.candidateService) return;
    this.creatingAccount = true;
    this.actionFeedback = "";
    this.actionError = "";
    this.cdr?.markForCheck();

    const username = (this.selectedRequest.email || "").split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

    this.candidateService.createCandidateAccount(this.selectedRequest.candidateId, username).subscribe({
      next: (res) => {
        this.creatingAccount = false;
        if (this.selectedRequest) {
          this.selectedRequest.accountCreated = true;
          this.selectedRequest.accountUsername = res.username || username;
        }
        this.actionFeedback = `Portal account created successfully (Username: ${res.username || username}). Credentials sent to ${this.selectedRequest?.email || "the candidate"}.`;
        this.cdr?.markForCheck();
      },
      error: (err) => {
        this.creatingAccount = false;
        this.actionError =
          err?.error?.error?.message || err?.message || "Failed to create portal account.";
        this.cdr?.markForCheck();
      },
    });
  }

  goToCandidatePortalAccount(): void {
    if (!this.selectedRequest) return;
    const candId = this.selectedRequest.candidateId;
    this.closeRequestModal();
    this.showNotifications = false;
    void this.router.navigate(["/external-resumes"], {
      queryParams: {
        candidateId: candId,
        section: "portal-account",
      },
    });
  }

  goToCandidateProfile(): void {
    if (!this.selectedRequest) return;
    const candId = this.selectedRequest.candidateId;
    this.closeRequestModal();
    void this.router.navigate(["/candidates", candId]);
  }

  goToImport(): void {
    this.router.navigate(["/candidates/import"]);
  }
}
