import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { ActivityLog } from "../../core/models/activity-log.model";
import { Employee } from "../../core/models/employee.model";
import { ActivityLogService } from "../../core/services/activity-log.service";
import { EmployeeService } from "../../core/services/employee.service";

@Component({
  selector: "app-activity-logs",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: "./activity-logs.html",
  styleUrl: "./activity-logs.css",
})
export class ActivityLogsComponent implements OnInit, OnDestroy {
  logs: ActivityLog[] = [];
  loading = false;

  search = "";
  role = "ALL";
  person = "ALL";
  type = "ALL";
  date = "";

  employees: Employee[] = [];
  private sub?: Subscription;
  private empSub?: Subscription;

  constructor(
    private activityLogService: ActivityLogService,
    private employeeService: EmployeeService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.employees = this.employeeService.getAll();
    this.empSub = this.employeeService.employees$.subscribe((employees) => {
      this.employees = employees;
      this.cdr.markForCheck();
    });

    this.sub = this.activityLogService.logs$.subscribe((logs) => {
      this.logs = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.loading = false;
      this.cdr.markForCheck();
    });

    this.load();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.empSub?.unsubscribe();
  }

  load(): void {
    this.logs = this.activityLogService
      .getAll()
      .sort((a, b) =>
        b.createdAt.localeCompare(
          a.createdAt,
        ),
      );
    this.loading = this.logs.length === 0;
    this.cdr.markForCheck();

    void this.employeeService.loadFromBackend();
    void this.activityLogService.loadFromBackend().finally(() => {
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  onFilterChange(): void {
    this.cdr.markForCheck();
  }

  get filtered(): ActivityLog[] {
    const query =
      this.search.trim().toLowerCase();

    return this.logs.filter((log) => {
      const employee =
        this.employeeService.getByName(
          log.performedBy,
        );

      const currentRole =
        this.getRole(log.performedBy);

      const matchesRole =
        this.role === "ALL" ||
        currentRole === this.role;

      const matchesPerson =
        this.person === "ALL" ||
        log.performedBy === this.person;

      const matchesType =
        this.type === "ALL" ||
        log.type === this.type;

      const matchesDate =
        !this.date ||
        log.createdAt.startsWith(
          this.date,
        );

      const matchesSearch =
        !query ||
        [
          log.candidateName,
          log.message,
          log.performedBy,
          log.type,
          employee?.role ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return (
        matchesRole &&
        matchesPerson &&
        matchesType &&
        matchesDate &&
        matchesSearch
      );
    });
  }

  get types(): string[] {
    return [
      ...new Set(
        this.logs
          .map((log) => log.type)
          .filter(Boolean),
      ),
    ].sort();
  }

  get people(): string[] {
    return this.employees
      .map((employee) => employee.name)
      .filter(Boolean)
      .sort();
  }

  get managerCount(): number {
    return this.logs.filter(
      (log) =>
        this.getRole(
          log.performedBy,
        ) === "MANAGER",
    ).length;
  }

  get hrCount(): number {
    return this.logs.filter(
      (log) =>
        this.getRole(
          log.performedBy,
        ) === "HR",
    ).length;
  }

  getRole(performedBy: string): string {
    const value =
      performedBy.trim().toLowerCase();

    if (value === "manager") {
      return "MANAGER";
    }

    const employee =
      this.employeeService.getByName(
        performedBy,
      );

    return employee?.role ?? "UNKNOWN";
  }

  roleLabel(performedBy: string): string {
    const role =
      this.getRole(performedBy);

    if (role === "MANAGER") {
      return "Manager";
    }

    if (role === "HR") {
      return "HR";
    }

    return "Unknown";
  }

  clearFilters(): void {
    this.search = "";
    this.role = "ALL";
    this.person = "ALL";
    this.type = "ALL";
    this.date = "";
    this.cdr.markForCheck();
  }

  refresh(): void {
    this.loading = true;
    this.cdr.markForCheck();
    void this.activityLogService.loadFromBackend(true).finally(() => {
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  label(type: string): string {
    return type.replaceAll(
      "_",
      " ",
    );
  }

  icon(type: string): string {
    if (type === "CALL") {
      return "☎";
    }

    if (
      type === "ASSIGNED" ||
      type === "REASSIGNED"
    ) {
      return "⇄";
    }

    if (type === "STATUS_CHANGED") {
      return "✓";
    }

    if (
      type === "FOLLOW_UP_CREATED" ||
      type === "FOLLOW_UP_COMPLETED"
    ) {
      return "◷";
    }

    if (type === "ARCHIVED") {
      return "□";
    }

    if (type === "NOTE_ADDED") {
      return "✎";
    }

    return "•";
  }
}