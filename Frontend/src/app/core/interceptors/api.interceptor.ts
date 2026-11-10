import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { ApiService } from "../services/api.service";

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith("/api/") && !request.url.startsWith("/api")) return next(request);

  const api = inject(ApiService);
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const csrfToken = api.getCsrfToken();
  const token = api.getToken() || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("recruitment-crm:token") : null);

  let headers = request.headers;
  if (isMutation && csrfToken) {
    headers = headers.set("X-CSRF-Token", csrfToken);
  }

  // Preserve existing Authorization header if already set by a portal service
  if (!headers.has("Authorization")) {
    if (request.url.includes("/trainer-portal")) {
      const trainerToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("tvk_trainer_portal_token") : null;
      if (trainerToken) {
        headers = headers.set("Authorization", `Bearer ${trainerToken}`);
      }
    } else if (request.url.includes("/candidate-portal")) {
      const candidateToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("tvk_candidate_portal_token") : null;
      if (candidateToken) {
        headers = headers.set("Authorization", `Bearer ${candidateToken}`);
      }
    } else if (token) {
      headers = headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return next(request.clone({ withCredentials: true, headers }));
};