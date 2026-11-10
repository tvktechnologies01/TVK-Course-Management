export type EmployeeRole = "MANAGER" | "HR";

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  email: string;
  active: boolean;
  username?: string;
  phone?: string;
  currentPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HrInvitation extends Employee {
  username: string;
  invitationToken?: string;
  invitationExpiresAt?: string;
  currentPassword?: string;
}

export interface HrPerformance {
  employee: Employee;
  totalAssigned: number;
  byStatus: Record<string, number>;
}
