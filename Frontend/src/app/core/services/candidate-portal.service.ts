import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, map } from "rxjs";
import { environment } from "../../../environments/environment";
import { Candidate, PaymentRecord } from "../models/candidate.model";
import { ApiEnvelope } from "./api.service";

export interface CandidateLoginResponse {
  token: string;
  mustChangePassword: boolean;
  candidate: Candidate;
}

export interface PublicPaymentInfo {
  candidateName: string;
  courseName: string;
  courseDuration: string;
  joiningDate?: string | null;
  courseStartDate?: string | null;
  totalFee: number;
  amountPaid: number;
  balance: number;
  paymentStatus: string;
  paymentInstructions: string;
  paymentQrCode: string;
  recentPayments: Array<{
    id: string;
    amount: number;
    status: string;
    transactionRef: string;
    paidAt: string;
    receiptNumber?: string;
  }>;
}

@Injectable({
  providedIn: "root",
})
export class CandidatePortalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/candidate-portal`;
  private readonly storageKey = "tvk_candidate_portal_token";

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
    }
  }

  isLoggedIn(): boolean {
    return Boolean(this.getToken());
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token || ""}`,
    });
  }

  // --- Candidate Authentication ---

  login(identifier: string, phone: string): Observable<CandidateLoginResponse> {
    return this.http
      .post<ApiEnvelope<CandidateLoginResponse>>(`${this.baseUrl}/login`, { identifier, phone })
      .pipe(map((res) => res.data));
  }

  loginWithCredentials(username: string, password: string): Observable<CandidateLoginResponse> {
    return this.http
      .post<ApiEnvelope<CandidateLoginResponse>>(`${this.baseUrl}/login`, { username, password })
      .pipe(map((res) => res.data));
  }

  changePassword(newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<ApiEnvelope<{ success: boolean; message: string }>>(`${this.baseUrl}/change-password`, { newPassword }, {
        headers: this.getAuthHeaders(),
      })
      .pipe(map((res) => res.data));
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<ApiEnvelope<{ success: boolean; message: string }>>(`${this.baseUrl}/forgot-password`, { email })
      .pipe(map((res) => res.data));
  }

  resetPassword(token: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<ApiEnvelope<{ success: boolean; message: string }>>(`${this.baseUrl}/reset-password`, { token, newPassword })
      .pipe(map((res) => res.data));
  }

  // --- Public Payment Link Page (No login required) ---

  getPublicPaymentDetails(token: string): Observable<PublicPaymentInfo> {
    return this.http
      .get<ApiEnvelope<PublicPaymentInfo>>(`${this.baseUrl}/payment-link/${encodeURIComponent(token)}`)
      .pipe(map((res) => res.data));
  }

  submitPublicPaymentProof(token: string, formData: FormData): Observable<PaymentRecord> {
    return this.http
      .post<ApiEnvelope<PaymentRecord>>(`${this.baseUrl}/payment-link/${encodeURIComponent(token)}/submit`, formData)
      .pipe(map((res) => res.data));
  }

  // --- Authenticated Portal Details & Actions ---

  getMyDetails(): Observable<Candidate> {
    return this.http
      .get<ApiEnvelope<Candidate>>(`${this.baseUrl}/my-details`, { headers: this.getAuthHeaders() })
      .pipe(map((res) => res.data));
  }

  submitCorrectionRequest(requestText: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<ApiEnvelope<{ success: boolean; message: string }>>(
        `${this.baseUrl}/correction-request`,
        { requestText },
        { headers: this.getAuthHeaders() },
      )
      .pipe(map((res) => res.data));
  }

  submitPayment(formData: FormData): Observable<PaymentRecord> {
    return this.http
      .post<ApiEnvelope<PaymentRecord>>(`${this.baseUrl}/submit-payment`, formData, {
        headers: this.getAuthHeaders(),
      })
      .pipe(map((res) => res.data));
  }

  downloadReceipt(receiptNumber: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/receipts/${encodeURIComponent(receiptNumber)}/download`, {
      headers: this.getAuthHeaders(),
      responseType: "blob",
    });
  }

  downloadCertificate(format: "png" | "pdf" = "png"): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/certificate/download?format=${format}`, {
      headers: this.getAuthHeaders(),
      responseType: "blob",
    });
  }

  downloadMyResume(resumeFileId?: string): Observable<Blob> {
    const url = resumeFileId
      ? `${this.baseUrl}/resumes/${encodeURIComponent(resumeFileId)}/download`
      : `${this.baseUrl}/resume/download`;
    return this.http.get(url, {
      headers: this.getAuthHeaders(),
      responseType: "blob",
    });
  }

  getCurriculum(): Observable<{
    available: boolean;
    courseName: string;
    courseId?: string;
    duration?: string;
    fees?: number;
    fileId?: string;
    curriculumFileName?: string;
    curriculumFileType?: string;
    curriculumFileSize?: number;
    curriculumUploadedAt?: string | null;
  }> {
    return this.http
      .get<ApiEnvelope<{
        available: boolean;
        courseName: string;
        courseId?: string;
        duration?: string;
        fees?: number;
        fileId?: string;
        curriculumFileName?: string;
        curriculumFileType?: string;
        curriculumFileSize?: number;
        curriculumUploadedAt?: string | null;
      }>>(`${this.baseUrl}/curriculum`, {
        headers: this.getAuthHeaders(),
      })
      .pipe(map((res) => res.data));
  }

  downloadCurriculum(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/curriculum/download`, {
      headers: this.getAuthHeaders(),
      responseType: "blob",
    });
  }

  contactManager(data: {
    name: string;
    email: string;
    phone: string;
    courseName: string;
    issueDescription: string;
  }): Observable<{ success: boolean; message: string; requestId?: string }> {
    return this.http
      .post<ApiEnvelope<{ success: boolean; message: string; requestId?: string }>>(
        `${this.baseUrl}/contact-manager`,
        data,
      )
      .pipe(map((res) => (res.data || res) as any));
  }

  getPublicCourses(): Observable<string[]> {
    return this.http
      .get<ApiEnvelope<string[]>>(`${this.baseUrl}/courses`)
      .pipe(map((res) => (res.data || []) as string[]));
  }
}
