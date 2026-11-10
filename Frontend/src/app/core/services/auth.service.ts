import { isPlatformBrowser } from "@angular/common";
import { Inject, Injectable, Injector, PLATFORM_ID } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { CandidateService } from "./candidate.service";
import { FollowUpService } from "./follow-up.service";
import { ApiService, ApiUser } from "./api.service";

type AuthenticatedUser = Pick<ApiUser, "username" | "employeeId" | "name" | "email" | "role">;
type CrmRole = ApiUser["role"];

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly isBrowser: boolean;

  private restorePromise?: Promise<boolean>;

  user: AuthenticatedUser | null = null;
  crmEnabled = true;

  constructor(
    private readonly api: ApiService,
    private readonly injector: Injector,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  get role(): CrmRole | null {
    return this.user?.role ?? null;
  }

  /**
   * Restore saved UI state without waiting for the server.
   * A background request validates the saved session.
   */
  async restoreSession(): Promise<boolean> {
    if (this.user) return true;
    if (!this.isBrowser) return false;
    if (this.restorePromise) {
      return this.restorePromise;
    }

    const savedToken = sessionStorage.getItem("recruitment-crm:token");
    if (savedToken) {
      this.api.setToken(savedToken);
    }

    this.restorePromise = firstValueFrom(this.api.me())
      .then((session) => {
        this.user = session.user;
        this.api.setCsrfToken(session.csrfToken);
        if (session.token) {
          this.api.setToken(session.token);
          sessionStorage.setItem("recruitment-crm:token", session.token);
        }
        this.setCacheOwner(session.user.employeeId);
        return true;
      })
      .catch(() => {
        this.clearPersistedSession();
        return false;
      })
      .finally(() => {
        this.restorePromise = undefined;
      });

    return this.restorePromise;
  }

  /**
   * Fresh login must wait for the server to verify credentials.
   * Do not bypass this request or store passwords locally.
   */
  async login(username: string, password: string): Promise<void> {
    const csrf = await firstValueFrom(this.api.csrf());
    this.api.setCsrfToken(csrf.csrfToken);
    const session = await firstValueFrom(this.api.login(username, password));
    this.api.setCsrfToken(session.csrfToken);
    if (session.token) {
      this.api.setToken(session.token);
      if (this.isBrowser) {
        sessionStorage.setItem("recruitment-crm:token", session.token);
      }
    }
    this.user = session.user;
    this.crmEnabled = true;
    this.setCacheOwner(session.user.employeeId);
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    if (!this.api.getCsrfToken()) {
      const csrf = await firstValueFrom(this.api.csrf());
      this.api.setCsrfToken(csrf.csrfToken);
    }
    await firstValueFrom(this.api.postNoContent("/auth/invitations/accept", { token, password }));
  }

  /**
   * Clear local session immediately. Server logout is best-effort.
   */
  logout(): void {
    const employeeId = this.user?.employeeId;
    void firstValueFrom(this.api.logout()).catch(() => undefined);

    if (employeeId) {
      this.injector
        .get(CandidateService)
        .clearCache(employeeId);

      this.injector
        .get(FollowUpService)
        .clearCache(employeeId);
    }

    this.clearPersistedSession();
  }

  private setCacheOwner(employeeId: string): void {
    this.injector
      .get(CandidateService)
      .setCacheOwner(employeeId);

    this.injector
      .get(FollowUpService)
      .setCacheOwner(employeeId);
  }

  private clearPersistedSession(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem("recruitment-crm:token");
      sessionStorage.removeItem("recruitment-crm:session-token");
      sessionStorage.removeItem("recruitment-crm:user");
    }
    this.api.setToken("");
    this.api.setCsrfToken("");
    this.user = null;
    this.crmEnabled = true;
  }
}