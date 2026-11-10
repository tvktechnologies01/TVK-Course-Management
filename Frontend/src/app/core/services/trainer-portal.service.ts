import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, map } from "rxjs";
import { environment } from "../../../environments/environment";
import { Trainer } from "../models/trainer.model";
import { ApiEnvelope } from "./api.service";

export interface TrainerLoginResponse {
  token: string;
  mustChangePassword: boolean;
  trainer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    specialization: string;
    employmentType: string;
    availability: string;
  };
}

@Injectable({
  providedIn: "root",
})
export class TrainerPortalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/trainer-portal`;
  private readonly storageKey = "tvk_trainer_portal_token";
  private readonly trainerKey = "tvk_trainer_portal_profile";

  setToken(token: string): void {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(this.storageKey, token);
    }
  }

  getToken(): string | null {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(this.storageKey);
    }
    return null;
  }

  clearToken(): void {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(this.storageKey);
      sessionStorage.removeItem(this.trainerKey);
    }
  }

  isLoggedIn(): boolean {
    return Boolean(this.getToken());
  }

  setCurrentTrainer(trainer: any): void {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(this.trainerKey, JSON.stringify(trainer));
    }
  }

  getCurrentTrainer(): any | null {
    if (typeof sessionStorage !== "undefined") {
      const data = sessionStorage.getItem(this.trainerKey);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : "",
    });
  }

  login(identifier: string, password: string): Observable<TrainerLoginResponse> {
    return this.http
      .post<ApiEnvelope<TrainerLoginResponse>>(`${this.baseUrl}/login`, { identifier, password })
      .pipe(
        map((res) => {
          if (!res.data) throw new Error("No data received from login.");
          return res.data;
        })
      );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/change-password`,
      { currentPassword, newPassword },
      { headers: this.authHeaders() }
    );
  }

  getMe(): Observable<any> {
    return this.http
      .get<ApiEnvelope<any>>(`${this.baseUrl}/me`, { headers: this.authHeaders() })
      .pipe(map((res) => res.data));
  }

  markAttendance(records: any[]): Observable<{ success: boolean; message: string; count: number }> {
    return this.http.post<{ success: boolean; message: string; count: number }>(
      `${this.baseUrl}/attendance`,
      { records },
      { headers: this.authHeaders() }
    );
  }

  getAttendance(params?: {
    batchId?: string;
    studentId?: string;
    date?: string;
    month?: string;
    courseName?: string;
  }): Observable<any[]> {
    let queryParams: any = {};
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val) queryParams[key] = val;
      });
    }
    return this.http
      .get<ApiEnvelope<any[]>>(`${this.baseUrl}/attendance`, {
        headers: this.authHeaders(),
        params: queryParams,
      })
      .pipe(map((res) => res.data || []));
  }

  getStudentSummary(studentId: string): Observable<any> {
    return this.http
      .get<ApiEnvelope<any>>(`${this.baseUrl}/student-summary/${encodeURIComponent(studentId)}`, {
        headers: this.authHeaders(),
      })
      .pipe(map((res) => res.data));
  }

  saveScorecard(data: {
    studentId: string;
    technicalScore: number;
    problemSolvingScore: number;
    communicationScore: number;
    readinessStatus: "READY" | "NEEDS_IMPROVEMENT" | "NOT_READY";
    feedback: string;
    recommendedRole?: string;
  }): Observable<any> {
    return this.http
      .post<ApiEnvelope<any>>(`${this.baseUrl}/scorecards`, data, {
        headers: this.authHeaders(),
      })
      .pipe(map((res) => res.data));
  }

  getScorecards(studentId?: string, courseName?: string): Observable<any[]> {
    let queryParams: any = {};
    if (studentId) queryParams.studentId = studentId;
    if (courseName) queryParams.courseName = courseName;
    return this.http
      .get<ApiEnvelope<any[]>>(`${this.baseUrl}/scorecards`, {
        headers: this.authHeaders(),
        params: queryParams,
      })
      .pipe(map((res) => res.data || []));
  }

  submitAbsence(data: {
    absenceStartDate?: string;
    expectedReturnDate?: string;
    leaveType?: string;
    absenceReason: string;
    handoverNotes?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/absence`, data, {
      headers: this.authHeaders(),
    });
  }

  checkIn(): Observable<{ success: boolean; data?: any; message: string; record?: any }> {
    return this.http.post<{ success: boolean; data?: any; message: string; record?: any }>(
      `${this.baseUrl}/check-in`,
      {},
      { headers: this.authHeaders() }
    );
  }

  getMyAttendance(filters?: { month?: string; startDate?: string; endDate?: string } | string): Observable<any> {
    let params: any = {};
    if (typeof filters === "string") {
      params.month = filters;
    } else if (filters) {
      if (filters.month) params.month = filters.month;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
    }
    return this.http
      .get<ApiEnvelope<any>>(`${this.baseUrl}/my-attendance`, {
        headers: this.authHeaders(),
        params,
      })
      .pipe(map((res) => res.data));
  }

  downloadMyAttendanceCsv(filters?: { month?: string; startDate?: string; endDate?: string }): Observable<Blob> {
    let params: any = {};
    if (filters) {
      if (filters.month) params.month = filters.month;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
    }
    return this.http.get(`${this.baseUrl}/my-attendance/export-csv`, {
      headers: this.authHeaders(),
      params,
      responseType: "blob",
    });
  }

  resumeWork(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/resume-work`, {}, {
      headers: this.authHeaders(),
    });
  }

  getHolidays(): Observable<any[]> {
    return this.http
      .get<ApiEnvelope<any[]>>(`${this.baseUrl}/holidays`, { headers: this.authHeaders() })
      .pipe(map((res) => res.data || []));
  }

  logout(): void {
    this.clearToken();
  }
}
