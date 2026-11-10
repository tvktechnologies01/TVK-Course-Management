import { HttpClient, HttpErrorResponse, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, catchError, map, throwError } from "rxjs";
import { environment } from "../../../environments/environment";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface ApiPage<T> {
  items: T[];
  totalOutboundCount?: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface ApiUser {
  id: string;
  username: string;
  name: string;
  email: string;
  employeeId: string;
  role: "MANAGER" | "HR";
  active: boolean;
  mustChangePassword: boolean;
}

export interface ApiSession {
  user: ApiUser;
  csrfToken: string;
  token?: string;
}

export function extractApiErrorMessage(error: unknown, fallback = "An unexpected error occurred."): string {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  if (error instanceof HttpErrorResponse || (typeof error === "object" && "error" in (error as Record<string, unknown>))) {
    const httpErr = error as HttpErrorResponse;
    const body = httpErr.error;

    if (body) {
      if (typeof body === "object" && body !== null) {
        if ("error" in body && typeof (body as { error: unknown }).error === "object" && (body as { error: { message?: string; details?: unknown[] } }).error !== null) {
          const innerError = (body as { error: { message?: string; details?: unknown[] } }).error;
          if (innerError.message) {
            if (Array.isArray(innerError.details) && innerError.details.length > 0 && !innerError.message.includes(":")) {
              const details = innerError.details
                .map((d: unknown) => {
                  if (typeof d === "object" && d !== null && "message" in d) {
                    return String((d as { message: unknown }).message);
                  }
                  return "";
                })
                .filter(Boolean)
                .join("; ");
              return details ? `${innerError.message} (${details})` : innerError.message;
            }
            return innerError.message;
          }
        }
        if ("message" in body && typeof (body as { message: unknown }).message === "string") {
          return (body as { message: string }).message;
        }
      }
      if (typeof body === "string" && body.trim().length > 0 && !body.startsWith("<!DOCTYPE")) {
        return body;
      }
    }

    if (httpErr.status === 401) return "Your session has expired or you are not signed in. Please log in again.";
    if (httpErr.status === 403) return "Permission denied: Only Managers have permission to perform this action.";
    if (httpErr.status === 404) return "The requested record was not found.";
    if (httpErr.status === 409) return "A record with this username, email, or employee ID already exists.";
    if (httpErr.status === 0) return "Unable to connect to the server. Please check your internet connection.";
  }

  if (error instanceof Error && !error.message.startsWith("Http failure response")) {
    return error.message;
  }

  return fallback;
}

@Injectable({ providedIn: "root" })
export class ApiService {
  private csrfToken = "";
  private authToken = "";
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  getCsrfToken(): string {
    return this.csrfToken;
  }

  setToken(token: string): void {
    this.authToken = token;
  }

  getToken(): string {
    return this.authToken;
  }

  csrf(): Observable<{ csrfToken: string }> {
    return this.get("/auth/csrf");
  }

  login(username: string, password: string): Observable<ApiSession> {
    return this.post("/auth/login", { username, password });
  }

  me(): Observable<ApiSession> {
    return this.get("/auth/me");
  }

  logout(): Observable<void> {
    return this.http.post<void>(this.url("/auth/logout"), {}, { withCredentials: true }).pipe(
      catchError((error: unknown) => throwError(() => new Error(extractApiErrorMessage(error))))
    );
  }

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== "") httpParams = httpParams.set(key, String(value));
    }
    return this.unwrap(this.http.get<ApiEnvelope<T>>(this.url(path), { params: httpParams, withCredentials: true }));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(this.http.post<ApiEnvelope<T>>(this.url(path), body, { withCredentials: true }));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(this.http.put<ApiEnvelope<T>>(this.url(path), body, { withCredentials: true }));
  }

  postNoContent(path: string, body: unknown): Observable<void> {
    return this.http.post<void>(this.url(path), body, { withCredentials: true }).pipe(
      catchError((error: unknown) => throwError(() => new Error(extractApiErrorMessage(error))))
    );
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(this.http.patch<ApiEnvelope<T>>(this.url(path), body, { withCredentials: true }));
  }

  delete<T = void>(path: string): Observable<T> {
    return this.http.delete<ApiEnvelope<T> | null>(this.url(path), { withCredentials: true }).pipe(
      map((response) => response?.data as T),
      catchError((error: unknown) => throwError(() => new Error(extractApiErrorMessage(error))))
    );
  }

  upload<T>(path: string, body: FormData): Observable<T> {
    return this.unwrap(this.http.post<ApiEnvelope<T>>(this.url(path), body, { withCredentials: true }));
  }

  blob(path: string): Observable<Blob> {
    return this.http.get(this.url(path), { responseType: "blob", withCredentials: true }).pipe(
      catchError((error: unknown) => throwError(() => new Error(extractApiErrorMessage(error))))
    );
  }

  private unwrap<T>(request: Observable<ApiEnvelope<T>>): Observable<T> {
    return request.pipe(
      map((response) => response.data),
      catchError((error: unknown) => throwError(() => new Error(extractApiErrorMessage(error))))
    );
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }
}

export type CrmRole = ApiUser["role"];