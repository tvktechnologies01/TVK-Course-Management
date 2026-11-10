import { inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { CanActivateFn, Router } from "@angular/router";
import { catchError, map, of, take } from "rxjs";
import { ApiService } from "../services/api.service";

export const crmEnabledGuard: CanActivateFn = () => {
  const api = inject(ApiService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return true;
  return api.get<{ status: string }>("/health").pipe(
    take(1),
    map((response) => response.status === "ok" ? true : router.createUrlTree(["/crm-stopped"])),
    catchError(() => of(router.createUrlTree(["/crm-stopped"], {
      queryParams: { reason: "offline" },
    }))),
  );
};
