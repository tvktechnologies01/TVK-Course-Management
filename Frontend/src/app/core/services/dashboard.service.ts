import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { Candidate } from "../models/candidate.model";
import { ApiService } from "./api.service";

export interface DashboardSummary {
  totalCandidates: number;
  activeCandidates: number;
  archivedCandidates: number;
  unassignedCandidates: number;
  sourceCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  followUpsDueToday: number;
  overdueFollowUps: number;
  followUpsDueWithinWeek: number;
  contactedCandidates: number;
  recentCandidates: Candidate[];
  selectedCandidates: Candidate[];
  hrPerformance: Array<{
    employeeId: string;
    name: string;
    email: string;
    totalAssigned: number;
    calls: number;
    contacted: number;
    interested: number;
    noResponse: number;
    interviewsScheduled: number;
    interviewsCompleted: number;
    selected: number;
    rejected: number;
  }>;
}

@Injectable({ providedIn: "root" })
export class DashboardService {
  constructor(private readonly api: ApiService) {}

  summary(): Promise<DashboardSummary> {
    return firstValueFrom(this.api.get<DashboardSummary>("/dashboard/summary"));
  }
}
