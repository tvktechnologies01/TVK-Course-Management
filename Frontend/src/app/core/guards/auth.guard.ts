import { inject } from "@angular/core";
import {
  CanActivateChildFn,
  CanActivateFn,
  Router,
} from "@angular/router";
import { AuthService } from "../services/auth.service";
import { CrmRole } from "../services/api.service";

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (await auth.restoreSession()) return true;
  return router.createUrlTree(["/login"]);
};

export const roleGuard: CanActivateChildFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data["roles"] as CrmRole[] | undefined;
  if (!roles || (auth.role && roles.includes(auth.role))) return true;
  return router.createUrlTree([
    auth.role === "HR" ? "/my-candidates" : "/dashboard",
  ]);
};
