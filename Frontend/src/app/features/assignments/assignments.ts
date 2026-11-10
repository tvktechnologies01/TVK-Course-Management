import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Candidate } from "../../core/models/candidate.model";
import { CandidateService } from "../../core/services/candidate.service";
import { EmployeeService } from "../../core/services/employee.service";

@Component({
  selector: "app-assignments",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./assignments.html",
  styleUrl: "./assignments.css",
})
export class AssignmentsComponent implements OnInit {
  candidates: Candidate[] = [];
  selectedIds: string[] = [];

  employees: ReturnType<EmployeeService["getHr"]> = [];

  selectedHrId = "";
  employeeId = "";

  search = "";
  unassignedSearch = "";

  constructor(
    private candidateService: CandidateService,
    private employeeService: EmployeeService,
    private cdr: ChangeDetectorRef,
  ) {
    this.loadEmployees();
    this.employeeService.employees$.subscribe(() => {
      this.loadEmployees();
      this.cdr.markForCheck();
    });

    this.candidateService.candidates$.subscribe(
      (candidates) => {
        this.candidates = candidates;

        this.selectedIds =
          this.selectedIds.filter((id) =>
            candidates.some(
              (candidate) =>
                candidate.id === id,
            ),
          );
        this.cdr.markForCheck();
      },
    );
  }

  async ngOnInit(): Promise<void> {
    try {
      await Promise.allSettled([
        this.employeeService.loadFromBackend(),
        this.candidateService.loadFromBackend(),
      ]);
    } finally {
      this.loadEmployees();
      this.cdr.detectChanges();
    }
  }

  private loadEmployees(): void {
    this.employees =
      this.employeeService.getHr();
  }

  get selectedHr() {
    return this.employees.find(
      (employee) =>
        employee.id === this.selectedHrId,
    );
  }

  get activeCandidates(): Candidate[] {
    return this.candidates.filter(
      (candidate) =>
        candidate.status !== "ARCHIVED",
    );
  }

  get unassignedCandidates(): Candidate[] {
    const query =
      this.unassignedSearch
        .trim()
        .toLowerCase();

    return this.activeCandidates.filter(
      (candidate) => {
        if (candidate.assignedToId) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          candidate.name,
          candidate.phone,
          candidate.email,
          candidate.position,
          candidate.location,
          candidate.experience,
          candidate.skills.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      },
    );
  }

  get unassignedCount(): number {
    return this.activeCandidates.filter(
      (candidate) =>
        !candidate.assignedToId,
    ).length;
  }

  get selectedCandidates(): Candidate[] {
    if (!this.selectedHrId) {
      return [];
    }

    const query =
      this.search.trim().toLowerCase();

    return this.candidates.filter(
      (candidate) => {
        if (
          candidate.status === "ARCHIVED"
        ) {
          return false;
        }

        if (
          candidate.assignedToId !==
          this.selectedHrId
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          candidate.name,
          candidate.phone,
          candidate.email,
          candidate.position,
          candidate.location,
          candidate.experience,
          candidate.skills.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      },
    );
  }

  get selectedCount(): number {
    return this.selectedIds.length;
  }

  get totalAssigned(): number {
    return this.selectedCandidates.length;
  }

  get calledCount(): number {
    return this.countStatuses([
      "CALLED",
      "NO_RESPONSE",
      "CALL_BACK",
      "INTERESTED",
      "NOT_INTERESTED",
      "INTERVIEW_SCHEDULED",
      "INTERVIEW_COMPLETED",
      "SELECTED",
      "REJECTED",
    ]);
  }

  get noResponseCount(): number {
    return this.countStatus(
      "NO_RESPONSE",
    );
  }

  get interestedCount(): number {
    return this.countStatus(
      "INTERESTED",
    );
  }

  get notInterestedCount(): number {
    return this.countStatus(
      "NOT_INTERESTED",
    );
  }

  get callbackCount(): number {
    return this.countStatus(
      "CALL_BACK",
    );
  }

  get scheduledCount(): number {
    return this.countStatus(
      "INTERVIEW_SCHEDULED",
    );
  }

  get completedCount(): number {
    return this.countStatus(
      "INTERVIEW_COMPLETED",
    );
  }

  get selectedCandidateCount(): number {
    return this.countStatus(
      "SELECTED",
    );
  }

  get rejectedCount(): number {
    return this.countStatus(
      "REJECTED",
    );
  }

  get onHoldCount(): number {
    return this.countStatus(
      "ON_HOLD",
    );
  }

  get followUpCount(): number {
    return this.selectedCandidates.filter(
      (candidate) =>
        Boolean(
          candidate.nextFollowUpAt,
        ) &&
        candidate.status !==
          "SELECTED" &&
        candidate.status !==
          "REJECTED" &&
        candidate.status !==
          "ARCHIVED",
    ).length;
  }

  get contactRate(): number {
    if (!this.totalAssigned) {
      return 0;
    }

    return Math.round(
      (this.calledCount /
        this.totalAssigned) *
        100,
    );
  }

  get interviewRate(): number {
    if (!this.totalAssigned) {
      return 0;
    }

    return Math.round(
      (this.scheduledCount /
        this.totalAssigned) *
        100,
    );
  }

  get selectionRate(): number {
    if (!this.totalAssigned) {
      return 0;
    }

    return Math.round(
      (this.selectedCandidateCount /
        this.totalAssigned) *
        100,
    );
  }

  get allSelected(): boolean {
    return (
      this.selectedCandidates.length >
        0 &&
      this.selectedCandidates.every(
        (candidate) =>
          this.selectedIds.includes(
            candidate.id,
          ),
      )
    );
  }

  get allUnassignedSelected(): boolean {
    return (
      this.unassignedCandidates.length >
        0 &&
      this.unassignedCandidates.every(
        (candidate) =>
          this.selectedIds.includes(
            candidate.id,
          ),
      )
    );
  }

  selectHr(employeeId: string): void {
    this.selectedHrId = employeeId;
    this.selectedIds = [];
    this.search = "";
    this.employeeId = "";
  }

  clearHr(): void {
    this.selectedHrId = "";
    this.selectedIds = [];
    this.search = "";
    this.employeeId = "";
  }

  toggle(id: string): void {
    this.selectedIds =
      this.selectedIds.includes(id)
        ? this.selectedIds.filter(
            (item) => item !== id,
          )
        : [...this.selectedIds, id];
  }

  toggleAll(): void {
    if (this.allSelected) {
      this.selectedIds =
        this.selectedIds.filter(
          (id) =>
            !this.selectedCandidates.some(
              (candidate) =>
                candidate.id === id,
            ),
        );

      return;
    }

    this.selectedIds = [
      ...new Set([
        ...this.selectedIds,
        ...this.selectedCandidates.map(
          (candidate) =>
            candidate.id,
        ),
      ]),
    ];
  }

  toggleUnassigned(id: string): void {
    this.toggle(id);
  }

  toggleAllUnassigned(): void {
    if (this.allUnassignedSelected) {
      this.selectedIds =
        this.selectedIds.filter(
          (id) =>
            !this.unassignedCandidates.some(
              (candidate) =>
                candidate.id === id,
            ),
        );

      return;
    }

    this.selectedIds = [
      ...new Set([
        ...this.selectedIds,
        ...this.unassignedCandidates.map(
          (candidate) =>
            candidate.id,
        ),
      ]),
    ];
  }

  async assign(): Promise<void> {
    const employee =
      this.employees.find(
        (item) =>
          item.id === this.employeeId,
      );

    if (
      !employee ||
      !this.selectedIds.length
    ) {
      return;
    }

    const candidateIds = [
      ...this.selectedIds,
    ];

    try {
      await this.candidateService.assignMany(
        candidateIds,
        employee.id,
        employee.name,
      );
    } catch (error) {
      console.error("Failed to assign candidates:", error);
    }

    this.selectedIds = [];
    this.employeeId = "";
  }

  countStatus(
    status: Candidate["status"],
  ): number {
    return this.selectedCandidates.filter(
      (candidate) =>
        candidate.status === status,
    ).length;
  }

  countStatuses(
    statuses: Candidate["status"][],
  ): number {
    return this.selectedCandidates.filter(
      (candidate) =>
        statuses.includes(
          candidate.status,
        ),
    ).length;
  }

  statusLabel(
    status: Candidate["status"],
  ): string {
    return status.replaceAll(
      "_",
      " ",
    );
  }
}