import { ChangeDetectorRef, Component, OnInit, inject, Optional } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { CandidatePortalService } from "../../core/services/candidate-portal.service";

export const DEFAULT_COURSES = [
  "Full Stack Development with Java & Angular",
  "Cloud Engineering with AWS & Azure",
  "DevOps Engineering",
  "Python for Web Development & Automation",
  "C# & .NET Development",
];

@Component({
  selector: "app-candidate-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./candidate-login.html",
  styleUrl: "./candidate-login.css",
})
export class CandidateLoginComponent implements OnInit {
  private readonly router: Router;
  private readonly portalService: CandidatePortalService;
  private readonly cdr: ChangeDetectorRef;

  constructor(
    @Optional() router?: Router,
    @Optional() portalService?: CandidatePortalService,
    @Optional() cdr?: ChangeDetectorRef,
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
        // unit tests pass mock
      }
    }
    this.router = resolvedRouter!;

    let resolvedPortal = portalService;
    if (!resolvedPortal) {
      try {
        resolvedPortal = inject(CandidatePortalService);
      } catch {
        // unit tests pass mock
      }
    }
    this.portalService = resolvedPortal!;
  }

  // Login Form State
  username = "";
  password = "";
  showPassword = false;
  loggingIn = false;
  errorMessage = "";
  successMessage = "";

  // Contact Manager Form State
  showContactManagerForm = false;
  contactFullName = "";
  contactEmail = "";
  contactPhone = "";
  contactCourse = "";
  contactIssue = "";
  submittingContact = false;
  contactSubmitted = false;
  contactError = "";
  contactSuccess = "";
  courseList: string[] = DEFAULT_COURSES;

  ngOnInit(): void {
    // If candidate already logged in and token is valid, redirect directly to candidate portal
    if (this.portalService?.isLoggedIn?.()) {
      void this.router.navigateByUrl("/candidate-portal");
    }

    // Fetch dynamic course list if available from backend
    if (this.portalService?.getPublicCourses) {
      this.portalService.getPublicCourses().subscribe({
        next: (courses) => {
          if (courses && courses.length > 0) {
            this.courseList = courses;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          // Use default courses fallback
        },
      });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    this.cdr.markForCheck();
  }

  login(): void {
    if (!this.username.trim() || !this.password) {
      this.errorMessage = "Please enter both your Username / Email and Password.";
      this.cdr.markForCheck();
      return;
    }

    this.loggingIn = true;
    this.errorMessage = "";
    this.successMessage = "";
    this.cdr.markForCheck();

    this.portalService.loginWithCredentials(this.username.trim(), this.password).subscribe({
      next: (response) => {
        this.portalService.setToken(response.token);
        this.loggingIn = false;
        // Direct entry to Candidate Portal with manager-provided credentials
        void this.router.navigateByUrl("/candidate-portal");
      },
      error: (err) => {
        this.loggingIn = false;
        this.errorMessage =
          err?.error?.error?.message ||
          err?.message ||
          "Invalid username or password. Please verify the credentials sent by your manager or contact HR.";
        this.cdr.markForCheck();
      },
    });
  }

  openContactManager(): void {
    this.showContactManagerForm = true;
    this.contactError = "";
    this.contactSuccess = "";
    this.contactSubmitted = false;
    this.errorMessage = "";
    this.cdr.markForCheck();
  }

  closeContactManager(): void {
    this.showContactManagerForm = false;
    this.contactError = "";
    this.contactSuccess = "";
    this.contactSubmitted = false;
    this.cdr.markForCheck();
  }

  submitContactRequest(): void {
    if (this.submittingContact) return;

    this.contactError = "";
    this.contactSuccess = "";

    // 1. Full Name validation
    const fullName = this.contactFullName.trim();
    if (!fullName || fullName.length < 2) {
      this.contactError = "Please enter your full name (minimum 2 characters).";
      this.cdr.markForCheck();
      return;
    }

    // 2. Registered Email validation
    const email = this.contactEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      this.contactError = "Please enter a valid registered email address.";
      this.cdr.markForCheck();
      return;
    }

    // 3. Phone Number validation
    const phone = this.contactPhone.trim();
    const cleanDigits = phone.replace(/\D/g, "");
    if (!phone || cleanDigits.length < 10) {
      this.contactError = "Please enter a valid phone number (at least 10 digits).";
      this.cdr.markForCheck();
      return;
    }

    // 4. Course Name validation
    const course = this.contactCourse.trim();
    if (!course) {
      this.contactError = "Please select your enrolled course.";
      this.cdr.markForCheck();
      return;
    }

    // 5. Issue Description validation
    const issue = this.contactIssue.trim();
    if (!issue || issue.length < 5) {
      this.contactError = "Please describe your issue (minimum 5 characters).";
      this.cdr.markForCheck();
      return;
    }

    this.submittingContact = true;
    this.cdr.markForCheck();

    this.portalService
      .contactManager({
        name: fullName,
        email,
        phone,
        courseName: course,
        issueDescription: issue,
      })
      .subscribe({
        next: () => {
          this.submittingContact = false;
          this.contactSubmitted = true;
          this.contactSuccess =
            "Your request has been submitted successfully. The manager will review your issue and assist you.";
          this.contactFullName = "";
          this.contactEmail = "";
          this.contactPhone = "";
          this.contactCourse = "";
          this.contactIssue = "";
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.submittingContact = false;
          this.contactError =
            err?.error?.error?.message ||
            err?.message ||
            "Unable to submit request at this time. Please try again or reach out to management directly.";
          this.cdr.markForCheck();
        },
      });
  }
}
