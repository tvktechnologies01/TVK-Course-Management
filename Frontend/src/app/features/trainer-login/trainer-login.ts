import { ChangeDetectorRef, Component, OnInit, inject, Optional } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { TrainerPortalService } from "../../core/services/trainer-portal.service";

@Component({
  selector: "app-trainer-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./trainer-login.html",
  styleUrl: "./trainer-login.css",
})
export class TrainerLoginComponent implements OnInit {
  private readonly router: Router;
  private readonly portalService: TrainerPortalService;
  private readonly cdr: ChangeDetectorRef;

  constructor(
    @Optional() router?: Router,
    @Optional() portalService?: TrainerPortalService,
    @Optional() cdr?: ChangeDetectorRef
  ) {
    let resolvedCdr = cdr;
    if (!resolvedCdr) {
      try {
        resolvedCdr = inject(ChangeDetectorRef);
      } catch {
        resolvedCdr = { markForCheck: () => {}, detectChanges: () => {} } as unknown as ChangeDetectorRef;
      }
    }
    this.cdr = resolvedCdr;

    let resolvedRouter = router;
    if (!resolvedRouter) {
      try {
        resolvedRouter = inject(Router);
      } catch {
        // unit test mock
      }
    }
    this.router = resolvedRouter!;

    let resolvedPortal = portalService;
    if (!resolvedPortal) {
      try {
        resolvedPortal = inject(TrainerPortalService);
      } catch {
        // unit test mock
      }
    }
    this.portalService = resolvedPortal!;
  }

  // Form State
  identifier = "";
  password = "";
  showPassword = false;
  loggingIn = false;
  errorMessage = "";
  successMessage = "";

  // First-time password change modal state
  showPasswordChangeModal = false;
  currentPasswordForChange = "";
  newPassword = "";
  confirmNewPassword = "";
  passwordChangeError = "";
  passwordChangeSaving = false;

  ngOnInit(): void {
    if (this.portalService?.isLoggedIn?.()) {
      void this.router.navigateByUrl("/trainer-portal");
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    this.cdr.markForCheck();
  }

  login(): void {
    if (!this.identifier.trim() || !this.password) {
      this.errorMessage = "Please enter both your Trainer ID / Email and Password.";
      this.cdr.markForCheck();
      return;
    }

    this.loggingIn = true;
    this.errorMessage = "";
    this.successMessage = "";
    this.cdr.markForCheck();

    this.portalService.login(this.identifier.trim(), this.password).subscribe({
      next: (response) => {
        this.portalService.setToken(response.token);
        this.portalService.setCurrentTrainer(response.trainer);
        this.loggingIn = false;

        if (response.mustChangePassword) {
          this.currentPasswordForChange = this.password;
          this.showPasswordChangeModal = true;
          this.cdr.markForCheck();
        } else {
          void this.router.navigateByUrl("/trainer-portal");
        }
      },
      error: (err) => {
        this.loggingIn = false;
        this.errorMessage =
          err?.error?.error?.message ||
          err?.message ||
          "Invalid Trainer ID / Email or Password. Please check with your Manager.";
        this.cdr.markForCheck();
      },
    });
  }

  submitNewPassword(): void {
    if (!this.newPassword || this.newPassword.length < 6) {
      this.passwordChangeError = "New password must be at least 6 characters long.";
      this.cdr.markForCheck();
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordChangeError = "Passwords do not match.";
      this.cdr.markForCheck();
      return;
    }

    this.passwordChangeSaving = true;
    this.passwordChangeError = "";
    this.cdr.markForCheck();

    this.portalService.changePassword(this.currentPasswordForChange, this.newPassword).subscribe({
      next: () => {
        this.passwordChangeSaving = false;
        this.showPasswordChangeModal = false;
        void this.router.navigateByUrl("/trainer-portal");
      },
      error: (err) => {
        this.passwordChangeSaving = false;
        this.passwordChangeError = err?.error?.error?.message || err?.message || "Failed to update password.";
        this.cdr.markForCheck();
      },
    });
  }
}
