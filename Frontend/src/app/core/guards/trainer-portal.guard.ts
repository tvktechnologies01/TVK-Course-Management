import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { TrainerPortalService } from "../services/trainer-portal.service";

export const trainerAuthGuard: CanActivateFn = () => {
  const portalService = inject(TrainerPortalService);
  const router = inject(Router);

  if (portalService.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(["/trainer-login"]);
};
