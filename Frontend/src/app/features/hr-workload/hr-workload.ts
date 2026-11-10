import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import {
  WorkloadService,
  WorkloadOverviewResponse,
  WorkloadCandidateItem,
  WorkloadAssignmentHistoryItem,
  WorkloadActivityItem,
  HrDetailsModalData,
} from "../../core/services/workload.service";
import { CandidateService } from "../../core/services/candidate.service";
import { EmployeeService } from "../../core/services/employee.service";
import { Candidate } from "../../core/models/candidate.model";

@Component({
  selector: "app-hr-workload",
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: "./hr-workload.html",
  styleUrl: "./hr-workload.css",
})
export class HrWorkloadComponent implements OnInit, OnDestroy {
  activeTab: "overview" | "candidates" | "history" | "activity" = "overview";

  // Data
  loading = false;
  overview: WorkloadOverviewResponse | null = null;
  candidates: WorkloadCandidateItem[] = [];
  totalCandidates = 0;
  history: WorkloadAssignmentHistoryItem[] = [];
  activities: WorkloadActivityItem[] = [];

  // Candidate Filters & Pagination
  candidateSearch = "";
  selectedHrFilter = "all";
  selectedStageFilter = "all";
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;

  // Selection for bulk assignment
  selectedCandidateIds: Set<string> = new Set();

  // Assign / Reassign Modal State
  showAssignModal = false;
  assignTargetCandidates: WorkloadCandidateItem[] = [];
  selectedTargetHrId = "";
  assignmentReason = "";
  assignSubmitting = false;
  assignError = "";

  // HR Details Modal State
  showHrModal = false;
  hrModalLoading = false;
  selectedHrDetails: HrDetailsModalData | null = null;

  // Notification message
  notificationMessage = "";
  notificationType: "success" | "error" = "success";

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly workloadService: WorkloadService,
    private readonly candidateService: CandidateService,
    private readonly employeeService: EmployeeService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;

    // 1. Subscribe to central CandidateService to ensure candidate data is always reactive
    this.subscriptions.add(
      this.candidateService.candidates$.subscribe((allCandidates) => {
        if (allCandidates && allCandidates.length > 0 && this.candidates.length === 0) {
          this.applyCandidateFallback(allCandidates);
        }
        this.cdr.markForCheck();
      })
    );

    // 2. Subscribe to central EmployeeService
    this.subscriptions.add(
      this.employeeService.employees$.subscribe(() => {
        this.cdr.markForCheck();
      })
    );

    // 3. Load all backend services in parallel
    try {
      await Promise.allSettled([
        this.candidateService.loadFromBackend(),
        this.employeeService.loadFromBackend(),
        this.loadOverview(),
        this.loadCandidates(),
        this.loadHistory(),
        this.loadActivities(),
      ]);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async loadOverview(): Promise<void> {
    try {
      this.overview = await this.workloadService.getOverview();
    } catch (err: any) {
      console.error("Failed to load workload overview", err);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async loadCandidates(): Promise<void> {
    this.loading = true;
    try {
      const res = await this.workloadService.getCandidates({
        search: this.candidateSearch.trim() || undefined,
        hrId: this.selectedHrFilter !== "all" ? this.selectedHrFilter : undefined,
        stage: this.selectedStageFilter !== "all" ? this.selectedStageFilter : undefined,
        page: this.currentPage,
        pageSize: this.pageSize,
      });

      if (res && res.items && res.items.length > 0) {
        this.candidates = res.items;
        this.totalCandidates = res.total;
        this.totalPages = res.totalPages;
      } else {
        // Fallback to central candidate service if dedicated workload route has 0 or is empty
        const fallback = this.candidateService.getActive();
        this.applyCandidateFallback(fallback);
      }

      this.selectedCandidateIds.clear();
    } catch (err: any) {
      console.error("Workload candidates query failed, falling back to central candidate store", err);
      const fallback = this.candidateService.getActive();
      this.applyCandidateFallback(fallback);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private applyCandidateFallback(list: Candidate[]): void {
    let filtered = list.filter((c) => c.status !== "ARCHIVED");

    if (this.selectedHrFilter !== "all") {
      if (this.selectedHrFilter === "unassigned") {
        filtered = filtered.filter((c) => !c.assignedToId);
      } else if (this.selectedHrFilter === "assigned") {
        filtered = filtered.filter((c) => !!c.assignedToId);
      } else {
        filtered = filtered.filter((c) => c.assignedToId === this.selectedHrFilter);
      }
    }

    if (this.selectedStageFilter !== "all") {
      if (this.selectedStageFilter === "pending") {
        filtered = filtered.filter((c) => ["NEW", "ASSIGNED", "CONTACT_PENDING"].includes(c.status));
      } else if (this.selectedStageFilter === "screening") {
        filtered = filtered.filter((c) => ["CALLED", "CALL_BACK", "INTERESTED"].includes(c.status));
      } else if (this.selectedStageFilter === "interview") {
        filtered = filtered.filter((c) => ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(c.status));
      } else if (this.selectedStageFilter === "completed") {
        filtered = filtered.filter((c) => ["SELECTED", "REJECTED"].includes(c.status) || Boolean(c.courseCompleted));
      }
    }

    if (this.candidateSearch.trim()) {
      const q = this.candidateSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.position.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    this.totalCandidates = filtered.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalCandidates / this.pageSize));
    const start = (this.currentPage - 1) * this.pageSize;
    this.candidates = filtered.slice(start, start + this.pageSize).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      position: c.position,
      experience: c.experience,
      location: c.location,
      status: c.status,
      assignedToId: c.assignedToId || null,
      assignedToName: c.assignedToName || null,
      resumeName: c.resumeName,
      resumeFileId: c.resumeFileId || null,
      appliedDate: c.appliedDate,
      updatedAt: c.updatedAt || c.appliedDate,
    }));
    this.cdr.markForCheck();
  }

  async loadHistory(): Promise<void> {
    try {
      this.history = await this.workloadService.getAssignmentHistory(undefined, 80);
    } catch (err: any) {
      console.error("Failed to load assignment history", err);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async loadActivities(): Promise<void> {
    try {
      this.activities = await this.workloadService.getActivityFeed(80);
    } catch (err: any) {
      console.error("Failed to load activity feed", err);
    } finally {
      this.cdr.markForCheck();
    }
  }

  onFilterChange(): void {
    this.currentPage = 1;
    void this.loadCandidates();
  }

  changePage(delta: number): void {
    const next = this.currentPage + delta;
    if (next >= 1 && next <= this.totalPages) {
      this.currentPage = next;
      void this.loadCandidates();
    }
  }

  // Quick Card Click Handlers
  filterByCard(type: string): void {
    this.activeTab = "candidates";
    this.currentPage = 1;
    this.candidateSearch = "";

    if (type === "active") {
      this.selectedHrFilter = "all";
      this.selectedStageFilter = "all";
    } else if (type === "unassigned") {
      this.selectedHrFilter = "unassigned";
      this.selectedStageFilter = "all";
    } else if (type === "assigned") {
      this.selectedHrFilter = "assigned";
      this.selectedStageFilter = "all";
    } else if (type === "pending") {
      this.selectedHrFilter = "all";
      this.selectedStageFilter = "pending";
    } else if (type === "completed") {
      this.selectedHrFilter = "all";
      this.selectedStageFilter = "completed";
    }
    void this.loadCandidates();
  }

  filterByHr(employeeId: string): void {
    this.activeTab = "candidates";
    this.selectedHrFilter = employeeId;
    this.selectedStageFilter = "all";
    this.currentPage = 1;
    void this.loadCandidates();
  }

  // Checkbox helpers
  isCandidateSelected(id: string): boolean {
    return this.selectedCandidateIds.has(id);
  }

  toggleCandidateSelection(id: string): void {
    if (this.selectedCandidateIds.has(id)) {
      this.selectedCandidateIds.delete(id);
    } else {
      this.selectedCandidateIds.add(id);
    }
    this.cdr.markForCheck();
  }

  toggleSelectAll(): void {
    if (this.allOnPageSelected()) {
      this.selectedCandidateIds.clear();
    } else {
      this.candidates.forEach((c) => this.selectedCandidateIds.add(c.id));
    }
    this.cdr.markForCheck();
  }

  allOnPageSelected(): boolean {
    return this.candidates.length > 0 && this.candidates.every((c) => this.selectedCandidateIds.has(c.id));
  }

  // Modals
  openAssignModalForOne(candidate: WorkloadCandidateItem): void {
    this.assignTargetCandidates = [candidate];
    this.selectedTargetHrId = "";
    this.assignmentReason = "";
    this.assignError = "";
    this.showAssignModal = true;
    this.cdr.markForCheck();
  }

  openBulkAssignModal(): void {
    if (this.selectedCandidateIds.size === 0) return;
    this.assignTargetCandidates = this.candidates.filter((c) => this.selectedCandidateIds.has(c.id));
    this.selectedTargetHrId = "";
    this.assignmentReason = "";
    this.assignError = "";
    this.showAssignModal = true;
    this.cdr.markForCheck();
  }

  closeAssignModal(): void {
    this.showAssignModal = false;
    this.assignTargetCandidates = [];
    this.cdr.markForCheck();
  }

  async submitAssignment(): Promise<void> {
    if (!this.selectedTargetHrId) {
      this.assignError = "Please select an active HR member.";
      this.cdr.markForCheck();
      return;
    }

    this.assignSubmitting = true;
    this.assignError = "";
    this.cdr.markForCheck();

    try {
      const ids = this.assignTargetCandidates.map((c) => c.id);
      await this.workloadService.assignCandidates(ids, this.selectedTargetHrId, this.assignmentReason);

      this.showToast(
        `Successfully ${ids.length > 1 ? `assigned ${ids.length} candidates` : "assigned candidate"}!`,
        "success"
      );

      this.closeAssignModal();
      this.selectedCandidateIds.clear();

      // Refresh data
      await Promise.allSettled([
        this.candidateService.loadFromBackend(true),
        this.loadOverview(),
        this.loadCandidates(),
        this.loadHistory(),
        this.loadActivities(),
      ]);
    } catch (err: any) {
      this.assignError = err?.error?.message || err?.message || "Failed to complete assignment.";
    } finally {
      this.assignSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  async viewHrDetails(employeeId: string): Promise<void> {
    this.showHrModal = true;
    this.hrModalLoading = true;
    this.selectedHrDetails = null;
    this.cdr.markForCheck();

    try {
      this.selectedHrDetails = await this.workloadService.getHrDetails(employeeId);
    } catch (err: any) {
      console.error("Failed to load HR details", err);
      this.showToast("Failed to load HR details", "error");
      this.showHrModal = false;
    } finally {
      this.hrModalLoading = false;
      this.cdr.markForCheck();
    }
  }

  closeHrModal(): void {
    this.showHrModal = false;
    this.selectedHrDetails = null;
    this.cdr.markForCheck();
  }

  showToast(message: string, type: "success" | "error"): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.notificationMessage = "";
      this.cdr.markForCheck();
    }, 4500);
  }

  getStatusClass(status: string): string {
    const s = (status || "").toUpperCase();
    if (["NEW", "ASSIGNED"].includes(s)) return "badge-info";
    if (["INTERVIEW_SCHEDULED", "INTERESTED"].includes(s)) return "badge-warning";
    if (["SELECTED"].includes(s)) return "badge-success";
    if (["REJECTED", "ARCHIVED"].includes(s)) return "badge-danger";
    return "badge-secondary";
  }

  formatStatus(status: string): string {
    return (status || "").replace(/_/g, " ");
  }
}
