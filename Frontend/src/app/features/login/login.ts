import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./login.html",
  styleUrl: "./login.css",
})
export class LoginComponent implements OnInit {
  username = "";
  password = "";
  showPassword = false;
  error = "";
  busy = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.auth.user || (await this.auth.restoreSession())) {
      await this.goToWorkspace();
    }
  }

  async submit(): Promise<void> {
    if (this.busy || !this.username.trim() || !this.password) return;
    this.busy = true;
    this.error = "";
    try {
      await this.auth.login(this.username, this.password);
      await this.goToWorkspace();
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : "Sign in failed. Check your credentials.";
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private async goToWorkspace(): Promise<void> {
    const safeReturnUrl = this.auth.role === "HR" ? "/my-candidates" : "/dashboard";
    await this.router.navigateByUrl(safeReturnUrl);
  }
}
