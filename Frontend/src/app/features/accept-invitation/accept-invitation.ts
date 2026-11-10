import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-accept-invitation",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./accept-invitation.html",
  styleUrl: "./accept-invitation.css",
})
export class AcceptInvitationComponent {
  readonly token: string;
  password = "";
  confirmPassword = "";
  busy = false;
  error = "";
  completed = false;

  constructor(
    route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.token = route.snapshot.queryParamMap.get("token") ?? "";
  }

  async submit(): Promise<void> {
    if (this.busy || !this.token || this.password.length < 12) return;
    if (this.password !== this.confirmPassword) {
      this.error = "Passwords do not match.";
      return;
    }
    this.busy = true;
    this.error = "";
    try {
      await this.auth.acceptInvitation(this.token, this.password);
      this.completed = true;
      this.password = "";
      this.confirmPassword = "";
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : "The invitation could not be accepted.";
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  goToLogin(): void {
    void this.router.navigateByUrl("/login");
  }
}