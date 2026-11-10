
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Subscription } from "rxjs";

import {
  Candidate,
  CandidateStatus,
} from "../../../core/models/candidate.model";
import { CandidateService } from "../../../core/services/candidate.service";
import { EmployeeService } from "../../../core/services/employee.service";

@Component({
  selector: "app-candidates",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./candidates.html",
  styleUrl: "./candidates.css",
})
export class CandidatesComponent implements OnInit, OnDestroy {
  candidates: Candidate[] = [];
  search = "";
  status: CandidateStatus | "ALL" = "ALL";
  assignee = "ALL";
  position = "ALL";
  employees: ReturnType<EmployeeService["getHr"]> = [];

  loading = false;
  refreshing = false;
  lastRefreshedAt: Date | null = null;
  errorMessage = "";

  private readonly subscriptions = new Subscription();
  private autoRefreshTimer: any = null;

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
    private readonly candidateService: CandidateService,
    private readonly employeeService: EmployeeService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.employees = this.employeeService.getHr();
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.candidateService.candidates$.subscribe((candidates) => {
        this.candidates = candidates;
        this.lastRefreshedAt = new Date();
        this.cdr.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.employeeService.employees$.subscribe((employees) => {
        this.employees = employees.filter((employee) => employee.role === "HR" && employee.active);
      }),
    );

    void this.loadCandidates(true);

    // Auto-refresh candidate list every 10 seconds in the background
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
    if (!silent) {
      if (!this.candidates.length) {
        this.loading = true;
      } else {
        this.refreshing = true;
      }
    } else {
      this.refreshing = true;
    }
    this.errorMessage = "";

    try {
      await this.candidateService.loadFromBackend(force);
      this.lastRefreshedAt = new Date();
    } catch (error: unknown) {
      console.error("Failed to load candidates:", error);
      if (!silent) {
        this.errorMessage =
          "Unable to load candidates from server. Please check your connection and try again.";
      }
    } finally {
      this.loading = false;
      this.refreshing = false;
      this.cdr.detectChanges();
    }
  }

  get filtered(): Candidate[] {
    const query = this.search.trim().toLowerCase();

    return this.candidates.filter((candidate) => {
      const matchesSearch =
        !query ||
        [
          candidate.name,
          candidate.phone,
          candidate.email,
          candidate.position,
          candidate.location,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        this.status === "ALL" || candidate.status === this.status;

      const matchesAssignee =
        this.assignee === "ALL" ||
        candidate.assignedToId === this.assignee;

      const matchesPosition =
        this.position === "ALL" ||
        candidate.position === this.position;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesAssignee &&
        matchesPosition
      );
    });
  }

  get positions(): string[] {
    return [
      ...new Set(
        this.candidates
          .map((candidate) => candidate.position)
          .filter(Boolean),
      ),
    ];
  }

  label(status: CandidateStatus): string {
    return status.replaceAll("_", " ");
  }

  async archive(candidate: Candidate): Promise<void> {
    if (!confirm(`Archive ${candidate.name}?`)) {
      return;
    }

    try {
      await this.candidateService.archive(candidate.id);
    } catch (error: unknown) {
      console.error("Failed to archive candidate:", error);
      this.errorMessage = "Unable to archive the candidate. Please try again.";
    }
  }

  ngOnDestroy(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
    this.subscriptions.unsubscribe();
  }
}
