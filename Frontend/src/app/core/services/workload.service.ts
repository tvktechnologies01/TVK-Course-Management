import { Injectable } from "@angular/core";
import { firstValueFrom, Observable } from "rxjs";
import { ApiService } from "./api.service";

export interface HrWorkloadStats {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  currentlyAssignedCount: number;
  previouslyHandledCount: number;
  pendingCount: number;
  screeningCount: number;
  interviewCount: number;
  completedCount: number;
  overdueCount: number;
  lastActivityDate: string | null;
}

export interface WorkloadSummary {
  totalActiveCandidates: number;
  unassignedCandidates: number;
  currentlyAssignedCandidates: number;
  pendingCandidates: number;
  overdueCandidates: number;
  completedCandidates: number;
}

export interface WorkloadOverviewResponse {
  summary: WorkloadSummary;
  hrMembers: HrWorkloadStats[];
}

export interface WorkloadCandidateItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  experience?: string;
  location?: string;
  status: string;
  assignedToId: string | null;
  assignedToName: string | null;
  resumeName?: string;
  resumeFileId?: string | null;
  appliedDate: string;
  updatedAt: string;
}

export interface WorkloadCandidatesResponse {
  items: WorkloadCandidateItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WorkloadAssignmentHistoryItem {
  _id: string;
  candidateId: string;
  candidateName: string;
  previousAssigneeId: string | null;
  previousAssigneeName: string | null;
  assignedToId: string;
  assignedToName: string;
  assignedByUserId: string;
  assignedByName: string;
  assignedAt: string;
  action?: string;
  reason?: string;
}

export interface WorkloadActivityItem {
  _id: string;
  candidateId: string;
  candidateName: string;
  type: string;
  message: string;
  performedBy: string;
  performedByUserId: string;
  createdAt: string;
}

export interface HrDetailsModalData {
  hr: {
    employeeId: string;
    name: string;
    email: string;
    phone: string;
    active: boolean;
  };
  currentCandidates: WorkloadCandidateItem[];
  previousCandidates: WorkloadCandidateItem[];
  historyRecords: WorkloadAssignmentHistoryItem[];
}

@Injectable({
  providedIn: "root",
})
export class WorkloadService {
  constructor(private readonly api: ApiService) {}

  async getOverview(): Promise<WorkloadOverviewResponse> {
    return firstValueFrom(
      this.api.get<WorkloadOverviewResponse>("/workload/overview")
    );
  }

  async getHrDetails(employeeId: string): Promise<HrDetailsModalData> {
    return firstValueFrom(
      this.api.get<HrDetailsModalData>(`/workload/hr/${encodeURIComponent(employeeId)}`)
    );
  }

  async getCandidates(params: {
    search?: string;
    hrId?: string;
    stage?: string;
    page?: number;
    pageSize?: number;
  }): Promise<WorkloadCandidatesResponse> {
    const queryParams: Record<string, string> = {};
    if (params.search) queryParams["search"] = params.search;
    if (params.hrId) queryParams["hrId"] = params.hrId;
    if (params.stage) queryParams["stage"] = params.stage;
    if (params.page) queryParams["page"] = String(params.page);
    if (params.pageSize) queryParams["pageSize"] = String(params.pageSize);

    return firstValueFrom(
      this.api.get<WorkloadCandidatesResponse>("/workload/candidates", queryParams)
    );
  }

  async assignCandidates(
    candidateIds: string[],
    employeeId: string,
    reason?: string
  ): Promise<{ items: any[] }> {
    return firstValueFrom(
      this.api.post<{ items: any[] }>("/workload/assign", {
        candidateIds,
        employeeId,
        reason,
      })
    );
  }

  async getAssignmentHistory(
    candidateId?: string,
    limit = 50
  ): Promise<WorkloadAssignmentHistoryItem[]> {
    const queryParams: Record<string, string> = { limit: String(limit) };
    if (candidateId) queryParams["candidateId"] = candidateId;

    return firstValueFrom(
      this.api.get<WorkloadAssignmentHistoryItem[]>("/workload/history", queryParams)
    );
  }

  async getActivityFeed(limit = 60): Promise<WorkloadActivityItem[]> {
    return firstValueFrom(
      this.api.get<WorkloadActivityItem[]>("/workload/activities", { limit: String(limit) })
    );
  }
}
