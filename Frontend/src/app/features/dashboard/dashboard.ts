import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit, Optional } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import {
  Candidate,
  CandidateStatus,
} from "../../core/models/candidate.model";
import { EmployeeService } from "../../core/services/employee.service";
import { DashboardService, DashboardSummary } from "../../core/services/dashboard.service";
import { CandidateService } from "../../core/services/candidate.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.css",
})
export class DashboardComponent implements OnInit, OnDestroy {
  employees: ReturnType<EmployeeService["getHr"]> = [];
  recent: Candidate[] = [];
  selectedCandidates: Candidate[] = [];
  loading = true;
  refreshing = false;
  lastRefreshedAt: Date | null = null;
  loadError = "";
  private autoRefreshTimer: any = null;
  private readonly subscriptions = new Subscription();
  private summary: DashboardSummary = {
    totalCandidates: 0,
    activeCandidates: 0,
    archivedCandidates: 0,
    unassignedCandidates: 0,
    sourceCounts: {},
    statusCounts: {},
    followUpsDueToday: 0,
    overdueFollowUps: 0,
    followUpsDueWithinWeek: 0,
    contactedCandidates: 0,
    recentCandidates: [],
    selectedCandidates: [],
    hrPerformance: [],
  };
  private metrics = {
    total: 0,
    assigned: 0,
    unassigned: 0,
    ir: 0,
    external: 0,
    outbound: 0,
    excel: 0,
    contacted: 0,
    interested: 0,
    selected: 0,
    scheduled: 0,
    completed: 0,
    rejected: 0,
    noResponse: 0,
    archived: 0,
  };
  private employeeMetrics = new Map<string, {
    total: number;
    contacted: number;
    interested: number;
    scheduled: number;
    selected: number;
    rejected: number;
    noResponse: number;
  }>();

  constructor(
    private employeeService: EmployeeService,
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef,
    @Optional() private candidateService?: CandidateService,
  ) {
    this.employees = this.employeeService.getHr();
    this.subscriptions.add(
      this.employeeService.employees$.subscribe((employees) => {
        this.employees = employees.filter((employee) => employee.role === "HR" && employee.active);
        this.cdr.markForCheck();
      }),
    );
  }

  ngOnInit(): void {
    void this.loadDashboardData();

    if (this.candidateService) {
      this.subscriptions.add(
        this.candidateService.candidates$.subscribe(() => {
          void this.loadDashboardData(true);
        }),
      );
    }

    // Auto-refresh dashboard metrics and candidates every 12 seconds in the background
    this.autoRefreshTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void this.loadDashboardData(true);
      }
    }, 12000);

    if (typeof window !== "undefined") {
      const onFocus = () => {
        void this.loadDashboardData(true);
      };
      window.addEventListener("focus", onFocus);
      this.subscriptions.add({
        unsubscribe: () => window.removeEventListener("focus", onFocus),
      });
    }
  }

  async loadDashboardData(silent = false): Promise<void> {
    if (!silent) {
      this.loading = true;
    } else {
      this.refreshing = true;
    }
    this.loadError = "";
    try {
      const summary = await this.dashboardService.summary();
      this.summary = summary;
      this.recent = summary.recentCandidates;
      this.selectedCandidates = summary.selectedCandidates;
      this.metrics = {
        total: summary.activeCandidates,
        assigned: summary.activeCandidates - summary.unassignedCandidates,
        unassigned: summary.unassignedCandidates,
        ir: summary.sourceCounts["IR_RESUME"] ?? 0,
        external: summary.sourceCounts["WEBSITE_APPLICATION"] ?? 0,
        outbound: summary.sourceCounts["OUTBOUND"] ?? 0,
        excel: summary.sourceCounts["EXCEL_IMPORT"] ?? 0,
        contacted: summary.contactedCandidates,
        interested: summary.statusCounts["INTERESTED"] ?? 0,
        selected: summary.statusCounts["SELECTED"] ?? 0,
        scheduled: summary.statusCounts["INTERVIEW_SCHEDULED"] ?? 0,
        completed: summary.statusCounts["INTERVIEW_COMPLETED"] ?? 0,
        rejected: summary.statusCounts["REJECTED"] ?? 0,
        noResponse: summary.statusCounts["NO_RESPONSE"] ?? 0,
        archived: summary.archivedCandidates,
      };
      this.employeeMetrics = new Map(summary.hrPerformance.map((employee) => [employee.employeeId, {
        total: employee.totalAssigned,
        contacted: employee.contacted,
        interested: employee.interested,
        scheduled: employee.interviewsScheduled,
        selected: employee.selected,
        rejected: employee.rejected,
        noResponse: employee.noResponse,
      }]));
      this.lastRefreshedAt = new Date();
      await this.employeeService.loadFromBackend();
    } catch (error: unknown) {
      if (!silent) {
        console.error("Unable to load dashboard data:", error);
        this.loadError = "Dashboard data could not be loaded. Check your connection and try again.";
      }
    } finally {
      this.loading = false;
      this.refreshing = false;
      this.cdr.detectChanges();
    }
  }

  retryLoad(): void {
    void this.loadDashboardData();
  }

  ngOnDestroy(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
    this.subscriptions.unsubscribe();
  }

  get total(): number {
    return this.metrics.total;
  }

  get assignedCount(): number {
    return this.metrics.assigned;
  }

  get unassignedCount(): number {
    return this.metrics.unassigned;
  }

  get irCount(): number {
    return this.metrics.ir;
  }

  get externalResumeCount(): number {
    return this.metrics.external;
  }

  get outboundResumeCount(): number {
    return this.metrics.outbound;
  }

  get excelResumeCount(): number {
    return this.metrics.excel;
  }

  get contacted(): number {
    return this.metrics.contacted;
  }

  get interested(): number {
    return this.metrics.interested;
  }

  get selectedCount(): number {
    return this.metrics.selected;
  }

  get scheduledCount(): number {
    return this.metrics.scheduled;
  }

  get completedInterviewCount(): number {
    return this.metrics.completed;
  }

  get rejectedCount(): number {
    return this.metrics.rejected;
  }

  get noResponseCount(): number {
    return this.metrics.noResponse;
  }

  get archivedCount(): number {
    return this.metrics.archived;
  }

  get pendingFollowUps(): number {
    return this.summary.followUpsDueWithinWeek;
  }

  countFor(employeeId: string): number {
    return this.employeeMetrics.get(employeeId)?.total ?? 0;
  }

  contactedFor(employeeId: string): number {
    return this.employeeMetrics.get(employeeId)?.contacted ?? 0;
  }

  interestedFor(employeeId: string): number {
    return this.employeeMetrics.get(employeeId)?.interested ?? 0;
  }

  scheduledFor(employeeId: string): number {
    return this.employeeMetrics.get(employeeId)?.scheduled ?? 0;
  }

  selectedFor(employeeId: string): number {
    return this.employeeMetrics.get(employeeId)?.selected ?? 0;
  }

  rejectedFor(employeeId: string): number {
    return this.employeeMetrics.get(employeeId)?.rejected ?? 0;
  }

  noResponseFor(employeeId: string): number {
    return this.employeeMetrics.get(employeeId)?.noResponse ?? 0;
  }

  contactedPercentage(employeeId: string): number {
    const count = this.countFor(employeeId);

    if (!count) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (this.contactedFor(employeeId) / count) * 100,
      ),
    );
  }

  sourcePercentage(count: number): number {
    return this.total
      ? Math.round((count / this.total) * 100)
      : 0;
  }

  pipelinePercentage(count: number): number {
    return this.total
      ? Math.round((count / this.total) * 100)
      : 0;
  }

  label(status: CandidateStatus): string {
    return status.replaceAll("_", " ");
  }

  sourceLabel(source: string): string {
    if (source === "IR_RESUME") {
      return "IR Resume";
    }

    if (source === "WEBSITE_APPLICATION") {
      return "External Resume";
    }

    if (source === "EXCEL_IMPORT") {
      return "Excel Resume";
    }

    return source;
  }
}
