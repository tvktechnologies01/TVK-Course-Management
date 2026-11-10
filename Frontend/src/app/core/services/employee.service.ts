import { Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom } from "rxjs";
import { Employee } from "../models/employee.model";
import { HrInvitation, HrPerformance } from "../models/employee.model";
import { Candidate } from "../models/candidate.model";
import { ApiPage, ApiService } from "./api.service";
import { AuthService } from "./auth.service";

@Injectable({ providedIn: "root" })
export class EmployeeService {
  private readonly subject = new BehaviorSubject<Employee[]>([]);
  readonly employees$ = this.subject.asObservable();
  private loading?: Promise<Employee[]>;
  private currentEmployeeId = "";

  constructor(private readonly api: ApiService, private readonly auth: AuthService) {}

  getAll(): Employee[] {
    return this.subject.value;
  }

  getHr(): Employee[] {
    return this.getAll().filter((employee) => employee.role === "HR" && employee.active);
  }

  getById(id: string | null): Employee | undefined {
    return this.getAll().find((employee) => employee.id === id);
  }

  getByName(name: string): Employee | undefined {
    const value = name.trim().toLowerCase();
    return this.getAll().find((employee) => employee.name.trim().toLowerCase() === value);
  }

  async loadFromBackend(): Promise<Employee[]> {
    if (this.auth.role === "HR" && this.auth.user) {
      const user = this.auth.user;
      const current: Employee = {
        id: user.employeeId,
        name: user.name,
        role: user.role,
        email: user.email,
        active: true,
      };
      this.currentEmployeeId = user.employeeId;
      this.subject.next([current]);
      return [current];
    }
    if (this.loading) return this.loading;
    this.loading = firstValueFrom(this.api.get<ApiPage<Employee>>("/employees", { page: 1, pageSize: 100 }))
      .then((page) => page.items)
      .then((records) => {
        this.currentEmployeeId = this.auth.user?.employeeId ?? "";
        this.subject.next(records);
        return records;
      })
      .finally(() => { this.loading = undefined; });
    return this.loading;
  }

  getCurrentEmployeeId(): string {
    return this.currentEmployeeId;
  }

  setCurrentEmployeeId(id: string): void {
    this.currentEmployeeId = id;
  }

  listHr(query: { page: number; pageSize: number; search?: string; active?: boolean }) {
    return firstValueFrom(this.api.get<{ items: Employee[]; pagination: { page: number; pageSize: number; total: number; pageCount: number } }>("/employees", {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search ?? "",
      active: query.active === undefined ? "" : query.active,
    }));
  }

  createHr(input: { username: string; name: string; email: string; employeeId: string; phone: string; password?: string }): Promise<HrInvitation> {
    return firstValueFrom(this.api.post<HrInvitation>("/employees", input));
  }

  updateHr(id: string, changes: Partial<Pick<Employee, "name" | "email" | "id" | "phone">> & { password?: string }): Promise<Employee> {
    const { id: employeeId, ...body } = changes;
    return firstValueFrom(this.api.patch<Employee>(`/employees/${encodeURIComponent(id)}`, {
      ...body,
      ...(employeeId ? { employeeId } : {}),
    }));
  }

  setHrActive(id: string, active: boolean): Promise<Employee> {
    return firstValueFrom(this.api.patch<Employee>(`/employees/${encodeURIComponent(id)}/status`, { active }));
  }

  getHrCandidates(id: string, page: number, pageSize: number) {
    return firstValueFrom(this.api.get<{ items: Candidate[]; pagination: { page: number; pageSize: number; total: number; pageCount: number } }>(`/employees/${encodeURIComponent(id)}/candidates`, { page, pageSize }));
  }

  getHrPerformance(id: string): Promise<HrPerformance> {
    return firstValueFrom(this.api.get<HrPerformance>(`/employees/${encodeURIComponent(id)}/performance`));
  }

  deleteHr(id: string): Promise<{ success: boolean; deletedId: string; unassignedCandidatesCount: number }> {
    return firstValueFrom(this.api.delete<{ success: boolean; deletedId: string; unassignedCandidatesCount: number }>(`/employees/${encodeURIComponent(id)}`));
  }
}