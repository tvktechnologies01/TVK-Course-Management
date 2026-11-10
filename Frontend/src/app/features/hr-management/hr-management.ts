import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Candidate } from "../../core/models/candidate.model";
import { Employee, HrInvitation, HrPerformance } from "../../core/models/employee.model";
import { EmployeeService } from "../../core/services/employee.service";
import { extractApiErrorMessage } from "../../core/services/api.service";

interface HrForm {
  username: string;
  name: string;
  email: string;
  employeeId: string;
  phone: string;
  password: string;
}

@Component({
  selector: "app-hr-management",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./hr-management.html",
  styleUrl: "./hr-management.css",
})
export class HrManagementComponent {
  employees: Employee[] = [];
  assignedCandidates: Candidate[] = [];
  performance: HrPerformance | null = null;
  selectedEmployee: Employee | null = null;
  invitation: HrInvitation | null = null;
  search = "";
  activeFilter: "all" | "active" | "inactive" = "all";
  page = 1;
  pageSize = 25;
  total = 0;
  pageCount = 1;
  candidatePage = 1;
  candidatePageCount = 1;
  loading = false;
  saving = false;
  error = "";
  message = "";
  formOpen = false;
  editingEmployeeId = "";
  copied = false;
  copiedField = "";
  showFormPassword = false;
  showProfilePassword = false;
  showCreatedPassword = false;
  tablePasswordVisible: Record<string, boolean> = {};
  form: HrForm = this.emptyForm();

  constructor(private readonly service: EmployeeService, private readonly cdr: ChangeDetectorRef) {
    void this.loadEmployees();
  }

  async loadEmployees(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const result = await this.service.listHr({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search.trim() || undefined,
        active: this.activeFilter === "all" ? undefined : this.activeFilter === "active",
      });
      this.employees = result.items;
      this.total = result.pagination.total;
      this.pageCount = result.pagination.pageCount;
      if (this.selectedEmployee) {
        const refreshed = this.employees.find((item) => item.id === this.selectedEmployee?.id);
        if (refreshed) this.selectedEmployee = refreshed;
      }
    } catch (error: unknown) {
      this.error = extractApiErrorMessage(error, "HR accounts could not be loaded.");
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  changeSearch(value: string): void {
    this.search = value;
    this.page = 1;
    void this.loadEmployees();
  }

  changeFilter(value: "all" | "active" | "inactive"): void {
    this.activeFilter = value;
    this.page = 1;
    void this.loadEmployees();
  }

  setPage(page: number): void {
    this.page = Math.min(Math.max(1, page), this.pageCount);
    void this.loadEmployees();
  }

  openCreate(): void {
    this.editingEmployeeId = "";
    this.form = this.emptyForm();
    this.showFormPassword = false;
    this.invitation = null;
    this.error = "";
    this.message = "";
    this.formOpen = true;
  }

  openEdit(employee: Employee): void {
    this.selectedEmployee = employee;
    this.editingEmployeeId = employee.id;
    this.form = {
      username: employee.username ?? "",
      name: employee.name,
      email: employee.email,
      employeeId: employee.id,
      phone: employee.phone ?? "",
      password: employee.currentPassword ?? "",
    };
    this.showFormPassword = false;
    this.error = "";
    this.message = "";
    this.formOpen = true;
  }

  closeForm(): void {
    if (this.invitation) return;
    this.formOpen = false;
  }

  toggleTablePassword(id: string): void {
    this.tablePasswordVisible[id] = !this.tablePasswordVisible[id];
  }

  async copyText(text: string, fieldName: string): Promise<void> {
    if (!text) return;

    const copySuccess = () => {
      this.copiedField = fieldName;
      this.error = "";
      this.cdr.markForCheck();
      setTimeout(() => {
        if (this.copiedField === fieldName) {
          this.copiedField = "";
          this.cdr.markForCheck();
        }
      }, 1800);
    };

    // 1. Try modern clipboard API if supported and available (HTTPS or localhost)
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        copySuccess();
        return;
      } catch {
        // Fall back to execCommand below
      }
    }

    // 2. Reliable fallback for HTTP contexts and older browsers using document.execCommand
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      textArea.style.opacity = "0";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        copySuccess();
        return;
      }
    } catch {
      // Continue to error below
    }

    this.error = "Copy failed. Please copy manually.";
    this.cdr.markForCheck();
  }

  async copyCredentials(): Promise<void> {
    const name = this.invitation?.name || this.form.name;
    const username = this.invitation?.username || this.form.username;
    const password = this.invitation?.currentPassword || this.form.password;
    const empId = this.invitation?.id || this.form.employeeId;
    const loginUrl = `${window.location.origin}/login`;

    const text = `Recruitment CRM - HR Account Credentials\nName: ${name}\nEmployee ID: ${empId}\nUsername: ${username}\nPassword: ${password}\nLogin URL: ${loginUrl}`;
    await this.copyText(text, "credentials");
  }

  async save(): Promise<void> {
    if (this.saving) return;
    this.error = "";
    this.message = "";

    const name = this.form.name.trim();
    const email = this.form.email.trim();
    const employeeId = this.form.employeeId.trim();
    const username = this.form.username.trim();
    const password = this.form.password.trim();
    const phone = this.form.phone.trim();

    // Frontend validations
    if (!name) {
      this.error = "Please enter the HR full name.";
      return;
    }
    if (!email) {
      this.error = "Please enter the HR work email.";
      return;
    }
    if (!employeeId) {
      this.error = "Please enter an Employee ID.";
      return;
    }

    if (!this.editingEmployeeId) {
      if (!username) {
        this.error = "Please enter a username for this HR.";
        return;
      }
      if (username.length < 3) {
        this.error = "Username must be at least 3 characters long.";
        return;
      }
      if (!password) {
        this.error = "Please enter a password for this HR account.";
        return;
      }
      if (password.length < 6) {
        this.error = "Password must be at least 6 characters long.";
        return;
      }
    } else if (password && password.length < 6) {
      this.error = "Password must be at least 6 characters long.";
      return;
    }

    this.saving = true;
    try {
      if (this.editingEmployeeId) {
        const updated = await this.service.updateHr(this.editingEmployeeId, {
          name,
          email,
          id: employeeId,
          phone,
          password: password || undefined,
        });
        this.message = `${updated.name}'s profile and password were updated.`;
        this.selectedEmployee = updated;
        this.formOpen = false;
        await this.loadEmployees();
      } else {
        this.invitation = await this.service.createHr({
          username,
          name,
          email,
          employeeId,
          phone,
          password,
        });
        this.selectedEmployee = this.invitation;
        this.message = "HR account created successfully with password. Login credentials are ready below.";
        await this.loadEmployees();
      }
    } catch (error: unknown) {
      this.error = extractApiErrorMessage(error, "The HR account could not be saved.");
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async selectEmployee(employee: Employee): Promise<void> {
    this.selectedEmployee = employee;
    this.candidatePage = 1;
    await this.loadEmployeeDetails();
  }

  async loadEmployeeDetails(): Promise<void> {
    if (!this.selectedEmployee) return;
    try {
      const [candidateResult, performance] = await Promise.all([
        this.service.getHrCandidates(this.selectedEmployee.id, this.candidatePage, 10),
        this.service.getHrPerformance(this.selectedEmployee.id),
      ]);
      this.assignedCandidates = candidateResult.items;
      this.candidatePageCount = candidateResult.pagination.pageCount;
      this.performance = performance;
    } catch (error: unknown) {
      this.error = extractApiErrorMessage(error, "HR profile details could not be loaded.");
    }
    this.cdr.markForCheck();
  }

  setCandidatePage(page: number): void {
    this.candidatePage = Math.min(Math.max(1, page), this.candidatePageCount);
    void this.loadEmployeeDetails();
  }

  async toggleActive(employee: Employee): Promise<void> {
    const action = employee.active ? "deactivate" : "activate";
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${employee.name}'s account?`)) return;
    this.error = "";
    try {
      const updated = await this.service.setHrActive(employee.id, !employee.active);
      this.selectedEmployee = updated;
      this.message = `${updated.name}'s account is now ${updated.active ? "active" : "inactive"}.`;
      await this.loadEmployees();
      if (this.selectedEmployee) await this.loadEmployeeDetails();
    } catch (error: unknown) {
      this.error = extractApiErrorMessage(error, "Account status could not be changed.");
    }
  }

  async deleteEmployee(employee: Employee): Promise<void> {
    const isSelected = this.selectedEmployee?.id === employee.id;
    const count = isSelected ? this.assignedCandidates.length : 0;
    const warning = count > 0 ? `\n\nNote: ${count} candidate(s) currently assigned to this account will be automatically unassigned.` : "";
    if (!window.confirm(`Permanently delete ${employee.name}'s HR account? This cannot be undone.${warning}`)) {
      return;
    }

    this.error = "";
    this.message = "";
    try {
      const result = await this.service.deleteHr(employee.id);
      this.message = `${employee.name}'s HR account was deleted.${result.unassignedCandidatesCount ? ` (${result.unassignedCandidatesCount} candidate(s) unassigned)` : ""}`;
      if (isSelected) {
        this.selectedEmployee = null;
        this.assignedCandidates = [];
        this.performance = null;
      }
      await this.loadEmployees();
    } catch (error: unknown) {
      this.error = extractApiErrorMessage(error, "HR account could not be deleted.");
    } finally {
      this.cdr.markForCheck();
    }
  }

  finishInvitation(): void {
    this.invitation = null;
    this.formOpen = false;
    this.form = this.emptyForm();
  }

  statusCount(status: string): number {
    return this.performance?.byStatus[status] ?? 0;
  }

  private emptyForm(): HrForm {
    return { username: "", name: "", email: "", employeeId: "", phone: "", password: "" };
  }
}