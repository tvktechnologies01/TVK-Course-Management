import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import {
  ActivatedRoute,
  RouterLink,
} from "@angular/router";
import {
  Candidate,
  CandidateStatus,
} from "../../../core/models/candidate.model";
import { ActivityLog } from "../../../core/models/activity-log.model";
import { FollowUp } from "../../../core/models/follow-up.model";
import { ActivityLogService } from "../../../core/services/activity-log.service";
import { AuthService } from "../../../core/services/auth.service";
import { CandidateService } from "../../../core/services/candidate.service";
import { EmployeeService } from "../../../core/services/employee.service";
import { FollowUpService } from "../../../core/services/follow-up.service";
import { ResumeStorageService } from "../../../core/services/resume-storage.service";
import {
  EMAIL_TEMPLATE_OPTIONS,
  EmailTemplateKey,
  generateEmailTemplate,
} from "../../../core/models/email-template.model";
import {
  WHATSAPP_TEMPLATE_OPTIONS,
  WhatsAppTemplateKey,
  generateWhatsAppTemplate,
} from "../../../core/models/whatsapp-template.model";

@Component({
  selector: "app-candidate-details",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: "./candidate-details.html",
  styleUrl: "./candidate-details.css",
})
export class CandidateDetailsComponent {
  candidate: Candidate | undefined;

  logs: ActivityLog[] = [];

  note = "";

  selectedStatus: CandidateStatus = "NEW";

  emailModalOpen = false;
  emailSubject = "";
  emailMessage = "";
  emailTemplateKey: EmailTemplateKey = "APPLICATION_UPDATE";
  emailSending = false;
  emailError = "";
  emailSuccess = "";
  smtpConfigured = false;
  smtpDetails: { host: string | null; user: string | null; from: string | null } | null = null;
  readonly emailTemplateOptions = EMAIL_TEMPLATE_OPTIONS;

  whatsAppModalOpen = false;
  whatsAppMessage = "";
  whatsAppTemplateKey: WhatsAppTemplateKey = "APPLICATION_UPDATE";
  whatsAppSending = false;
  whatsAppError = "";
  whatsAppSuccess = "";
  whatsAppConfigured = false;
  whatsAppDetails: { configured: boolean; phoneId: string | null; displayPhone?: string | null; fullPhoneId?: string | null } | null = null;
  readonly whatsAppTemplateOptions = WHATSAPP_TEMPLATE_OPTIONS;

  // Edit Candidate Details & Correction Requests
  editModalOpen = false;
  activeCorrectionRequest: any = null;
  targetCorrectionId: string | null = null;
  editName = "";
  editEmail = "";
  editPhone = "";
  editPosition = "";
  editExperience = "";
  editLocation = "";
  editAddress = "";
  editState = "";
  editPincode = "";
  editDateOfBirth = "";
  editDegree = "";
  editCollege = "";
  editYearOfPassing = "";
  editSkills = "";
  editNotes = "";
  markCorrectionAsCompletedOnSave = true;
  savingCandidate = false;
  editError = "";
  editSuccess = "";
  candidateRequestsOpen = false;

  get totalRequestsCount(): number {
    return this.candidate?.correctionRequests?.length || 0;
  }

  onCandidateRequestsToggle(event: Event): void {
    const details = event.target as HTMLDetailsElement;
    this.candidateRequestsOpen = details.open;
  }

  resumeLoading = false;

  resumeAvailable = false;

  resumeError = "";

  loadingCandidate = true;

  loadError = "";

  private resumeBlob: Blob | null = null;

  followUpDate = "";

  readonly statuses: CandidateStatus[] = [
    "NEW",
    "ASSIGNED",
    "CONTACT_PENDING",
    "CALLED",
    "NO_RESPONSE",
    "CALL_BACK",
    "INTERESTED",
    "NOT_INTERESTED",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "SELECTED",
    "REJECTED",
    "ON_HOLD",
    "ARCHIVED",
  ];

  constructor(
    private route: ActivatedRoute,
    private candidateService: CandidateService,
    private activityLogService: ActivityLogService,
    private resumeStorage: ResumeStorageService,
    private followUpService: FollowUpService,
    private employeeService: EmployeeService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    const id =
      this.route.snapshot.paramMap.get(
        "id",
      );

    if (id) {
      this.candidateService.candidates$
        .pipe(takeUntilDestroyed())
        .subscribe((candidates) => {
          const candidate = candidates.find((item) => item.id === id);
          if (candidate) {
            this.setCandidate(candidate);
            this.loadingCandidate = false;
            this.loadError = "";
            this.checkAndOpenCorrection();
            this.cdr.markForCheck();
          }
        });
      void this.loadCandidate(id);
    }

    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params["correctionId"]) {
        this.targetCorrectionId = params["correctionId"];
        this.checkAndOpenCorrection();
      }
    });
  }

  get pendingCorrections(): any[] {
    return (this.candidate?.correctionRequests || []).filter((r) => r.status === "Pending");
  }

  openEditModal(): void {
    if (!this.candidate) return;
    this.editModalOpen = true;
    this.activeCorrectionRequest = this.pendingCorrections[0] || null;
    this.markCorrectionAsCompletedOnSave = Boolean(this.activeCorrectionRequest);
    this.editError = "";
    this.editSuccess = "";

    this.editName = this.candidate.name || "";
    this.editEmail = this.candidate.email || "";
    this.editPhone = this.candidate.phone || "";
    this.editPosition = this.candidate.position || this.candidate.courseName || "";
    this.editExperience = this.candidate.experience || "";
    this.editLocation = this.candidate.location || "";
    this.editAddress = this.candidate.address || "";
    this.editState = this.candidate.state || "";
    this.editPincode = this.candidate.pincode || "";
    this.editDateOfBirth = this.candidate.dateOfBirth || "";
    this.editDegree = this.candidate.degree || "";
    this.editCollege = this.candidate.college || "";
    this.editYearOfPassing = this.candidate.yearOfPassing || "";
    this.editSkills = (this.candidate.skills || []).join(", ");
    this.editNotes = this.candidate.notes || "";
    this.cdr.markForCheck();
  }

  openEditModalForCorrection(req: any): void {
    this.openEditModal();
    this.activeCorrectionRequest = req;
    this.markCorrectionAsCompletedOnSave = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    this.editModalOpen = false;
    this.activeCorrectionRequest = null;
    this.cdr.markForCheck();
  }

  async saveCandidateDetails(): Promise<void> {
    if (!this.candidate) return;
    if (!this.editName.trim()) {
      this.editError = "Full name is required.";
      this.cdr.markForCheck();
      return;
    }

    this.savingCandidate = true;
    this.editError = "";
    this.editSuccess = "";
    this.cdr.markForCheck();

    const skillsArray = this.editSkills
      ? this.editSkills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const changes: any = {
      name: this.editName.trim(),
      email: this.editEmail.trim(),
      phone: this.editPhone.trim(),
      position: this.editPosition.trim(),
      experience: this.editExperience.trim(),
      location: this.editLocation.trim(),
      address: this.editAddress.trim(),
      state: this.editState.trim(),
      pincode: this.editPincode.trim(),
      dateOfBirth: this.editDateOfBirth.trim(),
      degree: this.editDegree.trim(),
      college: this.editCollege.trim(),
      yearOfPassing: this.editYearOfPassing.trim(),
      skills: skillsArray,
      notes: this.editNotes.trim(),
    };

    if (this.markCorrectionAsCompletedOnSave) {
      const targetReq = this.activeCorrectionRequest || this.pendingCorrections[0];
      if (targetReq) {
        changes.completedCorrectionRequestId = targetReq.id;
      }
    }

    try {
      const updated = await firstValueFrom(this.candidateService.updateDetails(this.candidate.id, changes));
      this.savingCandidate = false;
      this.editModalOpen = false;
      this.activeCorrectionRequest = null;
      this.editSuccess = "Candidate details saved successfully and correction request marked as completed!";
      await this.loadCandidate(this.candidate.id);
      this.cdr.markForCheck();
    } catch (err: any) {
      this.savingCandidate = false;
      this.editError = err?.message || "Failed to update candidate details.";
      this.cdr.markForCheck();
    }
  }

  markCorrectionCompleted(requestId: string): void {
    if (!this.candidate) return;
    const cid = this.candidate.id;
    this.candidateService.updateCorrectionRequestStatus(cid, requestId, "Completed").subscribe({
      next: async (res) => {
        if (res?.candidate) {
          this.setCandidate(res.candidate);
        }
        await this.loadCandidate(cid);
        this.editSuccess = "Correction request marked as Completed (status updated to green).";
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to mark correction completed:", err);
      },
    });
  }

  markCorrectionPending(requestId: string): void {
    if (!this.candidate) return;
    const cid = this.candidate.id;
    this.candidateService.updateCorrectionRequestStatus(cid, requestId, "Pending").subscribe({
      next: async (res) => {
        if (res?.candidate) {
          this.setCandidate(res.candidate);
        }
        await this.loadCandidate(cid);
        this.editSuccess = "Correction request reopened as Pending (status updated to orange).";
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error("Failed to mark correction pending:", err);
      },
    });
  }

  private checkAndOpenCorrection(): void {
    if (!this.candidate || !this.targetCorrectionId) return;
    const req = (this.candidate.correctionRequests || []).find((r) => r.id === this.targetCorrectionId);
    if (req) {
      this.candidateRequestsOpen = true;
      this.openEditModalForCorrection(req);
      this.targetCorrectionId = null;
      setTimeout(() => {
        const el = document.getElementById("candidate-requests-section") as HTMLDetailsElement | null;
        if (el) {
          el.open = true;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);
    }
  }

  get sourceLabel(): string {
    if (!this.candidate) {
      return "";
    }

    if (
      this.candidate.source ===
      "IR_RESUME"
    ) {
      return "IR Resume";
    }

    if (
      this.candidate.source ===
      "WEBSITE_APPLICATION"
    ) {
      return "Website Application";
    }

    if (this.candidate.source === "EXCEL_IMPORT") {
      return "Excel Resume";
    }

    return this.candidate.source;
  }

  get currentActor(): string {
    if (!this.candidate) {
      return "Manager";
    }

    if (
      this.candidate.assignedToId
    ) {
      const assignedEmployee =
        this.employeeService.getById(
          this.candidate.assignedToId,
        );

      if (
        assignedEmployee &&
        assignedEmployee.role === "HR"
      ) {
        return assignedEmployee.name;
      }
    }

    const employeeId = this.employeeService.getCurrentEmployeeId();

    if (!employeeId) {
      return "Manager";
    }

    const employee =
      this.employeeService.getById(
        employeeId,
      );

    if (!employee) {
      return "Manager";
    }

    return employee.name;
  }

  private async loadCandidate(
    id: string,
  ): Promise<void> {
    const fromMemory = this.candidateService.getById(id);
    if (fromMemory) {
      this.setCandidate(fromMemory);
      this.loadingCandidate = false;
      this.cdr.markForCheck();
    } else {
      this.loadingCandidate = true;
      this.cdr.markForCheck();
    }

    try {
      const fetched = await firstValueFrom(this.candidateService.fetchById(id));
      if (fetched) {
        this.setCandidate(fetched);
        this.loadError = "";
      }
    } catch (error: unknown) {
      console.error("Unable to load candidate details:", error);
      if (!this.candidate) {
        this.loadError = "Candidate details could not be loaded. Check your connection and try again.";
      }
    } finally {
      this.loadingCandidate = false;
      this.checkAndOpenCorrection();
      this.cdr.markForCheck();
    }

    const logsRefresh = this.activityLogService
      .loadFromBackend()
      .then(() => {
        this.loadLogs(id);
        this.cdr.markForCheck();
      })
      .catch((error: unknown) => {
        console.error("Unable to load candidate activity:", error);
      });

    await logsRefresh;
  }

  private setCandidate(candidate: Candidate | undefined): void {
    this.candidate = candidate;
    if (!candidate) {
      return;
    }

    this.selectedStatus = candidate.status;
    this.resumeAvailable = Boolean(candidate.resumeFileId || candidate.resumeName);
    this.resumeBlob = null;
  }

  private loadLogs(
    candidateId: string,
  ): void {
    this.logs =
      this.activityLogService.getByCandidate(
        candidateId,
      );
  }

  async changeStatus(): Promise<void> {
    if (!this.candidate) {
      return;
    }

    if (
      this.candidate.status ===
      this.selectedStatus
    ) {
      return;
    }

    const previousStatus =
      this.candidate.status;

    const actor =
      this.currentActor;

    await this.candidateService.updateStatus(
      this.candidate.id,
      this.selectedStatus,
      `Status changed from ${this.label(previousStatus)} to ${this.label(this.selectedStatus)} by ${actor}`,
      actor,
    );

    this.refresh();
  }

  async archive(): Promise<void> {
    if (!this.candidate) {
      return;
    }

    await this.candidateService.archive(
      this.candidate.id,
    );

    this.refresh();
  }

  async restore(): Promise<void> {
    if (!this.candidate) {
      return;
    }

    await this.candidateService.restore(
      this.candidate.id,
    );

    this.refresh();
  }

  openEmail(): void {
    if (!this.candidate?.email) return;
    this.emailModalOpen = true;
    this.emailError = "";
    this.emailSuccess = "";
    this.emailSending = false;
    this.emailTemplateKey = "APPLICATION_UPDATE";
    this.applyEmailTemplate();

    this.candidateService.getEmailStatus().then((status) => {
      this.smtpConfigured = status.configured;
      this.smtpDetails = status;
      this.applyEmailTemplate();
      this.cdr.markForCheck();
    }).catch(() => {
      this.smtpConfigured = false;
    });
  }

  get senderFromEmail(): string {
    return this.smtpDetails?.from || "training@tvktechs.com";
  }

  closeEmail(): void {
    this.emailModalOpen = false;
    this.emailSubject = "";
    this.emailMessage = "";
    this.emailError = "";
    this.emailSuccess = "";
    this.emailSending = false;
  }

  onTemplateChange(key: EmailTemplateKey): void {
    this.emailTemplateKey = key;
    this.applyEmailTemplate();
  }

  private applyEmailTemplate(): void {
    if (!this.candidate) return;
    const sender = this.auth.user;
    const template = generateEmailTemplate(
      this.emailTemplateKey,
      this.candidate.name,
      this.candidate.position,
      sender?.name ?? "Recruitment Team",
      this.senderFromEmail,
    );
    this.emailSubject = template.subject;
    this.emailMessage = template.message;
  }

  async sendEmail(): Promise<void> {
    if (!this.candidate?.email) return;
    const to = this.candidate.email.trim();
    const subject = this.emailSubject.trim();
    const message = this.emailMessage.trim();
    if (!to || !subject || !message) {
      this.emailError = "Please fill in all email fields.";
      return;
    }

    this.emailSending = true;
    this.emailError = "";
    this.emailSuccess = "";

    try {
      await this.candidateService.sendEmail(this.candidate.id, {
        to,
        subject,
        message,
      });
      this.emailSuccess = `Email sent successfully to ${to}`;
      await this.activityLogService.loadFromBackend();
      this.refresh();
      setTimeout(() => {
        this.closeEmail();
        this.cdr.markForCheck();
      }, 1200);
    } catch (err: unknown) {
      this.emailError = err instanceof Error ? err.message : "Failed to send email. Please try again.";
    } finally {
      this.emailSending = false;
      this.cdr.markForCheck();
    }
  }

  get currentUserEmail(): string {
    return this.auth.user?.email || "";
  }

  get currentUserName(): string {
    return this.auth.user?.name || "Recruiter";
  }

  openWhatsApp(): void {
    if (!this.candidate?.phone) return;
    this.whatsAppModalOpen = true;
    this.whatsAppError = "";
    this.whatsAppSuccess = "";
    this.whatsAppSending = false;
    this.whatsAppTemplateKey = "APPLICATION_UPDATE";
    this.applyWhatsAppTemplate();

    this.candidateService.getWhatsAppStatus().then((status) => {
      this.whatsAppConfigured = status.configured;
      this.whatsAppDetails = status;
      this.cdr.markForCheck();
    }).catch(() => {
      this.whatsAppConfigured = false;
    });
  }

  closeWhatsApp(): void {
    this.whatsAppModalOpen = false;
    this.whatsAppMessage = "";
    this.whatsAppError = "";
    this.whatsAppSuccess = "";
    this.whatsAppSending = false;
  }

  onWhatsAppTemplateChange(key: WhatsAppTemplateKey): void {
    this.whatsAppTemplateKey = key;
    this.applyWhatsAppTemplate();
  }

  private applyWhatsAppTemplate(): void {
    if (!this.candidate) return;
    const sender = this.auth.user?.name || "Recruitment Team";
    this.whatsAppMessage = generateWhatsAppTemplate(
      this.whatsAppTemplateKey,
      this.candidate.name,
      this.candidate.position,
      sender,
    );
  }

  async sendDirectWhatsApp(): Promise<void> {
    if (!this.candidate || !this.candidate.phone) return;
    const message = this.whatsAppMessage.trim();
    if (!message) {
      this.whatsAppError = "Please enter a message to send.";
      return;
    }

    this.whatsAppSending = true;
    this.whatsAppError = "";
    this.whatsAppSuccess = "";

    try {
      await this.candidateService.sendWhatsApp(this.candidate.id, {
        phone: this.candidate.phone,
        message,
        templateKey: this.whatsAppTemplateKey,
        candidateName: this.candidate.name,
        candidatePosition: this.candidate.position,
      });
      this.whatsAppSuccess = `WhatsApp message sent successfully via Meta Cloud API!`;
      await this.activityLogService.loadFromBackend();
      this.refresh();
      setTimeout(() => {
        this.closeWhatsApp();
        this.cdr.markForCheck();
      }, 1500);
    } catch (err: unknown) {
      this.whatsAppError = err instanceof Error ? err.message : "Failed to send WhatsApp message.";
    } finally {
      this.whatsAppSending = false;
      this.cdr.markForCheck();
    }
  }

  get whatsAppSenderDisplay(): string {
    return this.whatsAppDetails?.displayPhone || (this.whatsAppDetails?.phoneId ? `Phone ID: ${this.whatsAppDetails.phoneId}` : "Meta Cloud API");
  }

  openWhatsAppWeb(): void {
    const candidate = this.candidate;
    let phone = candidate?.phone.replace(/\D/g, "") || "";
    if (phone.startsWith("0") && phone.length === 11) {
      phone = phone.slice(1);
    }
    if (phone.length === 10) {
      phone = "91" + phone;
    }
    const message = this.whatsAppMessage.trim();
    if (!candidate || !phone || !message) return;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    this.closeWhatsApp();
  }

  async openResume(): Promise<void> {
    if (
      !this.candidate?.resumeFileId && !this.candidate?.resumeName
    ) {
      return;
    }

    this.resumeError = "";
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      this.resumeError = "Allow pop-ups to view the resume.";
      return;
    }

    this.resumeLoading = true;

    try {
      const blob = this.resumeBlob ?? await this.resumeStorage.get(
        this.candidate.resumeFileId ?? "",
        this.candidate.resumeName,
        this.candidate.id,
      );

      if (!blob) {
        this.resumeAvailable = false;
        preview.close();
        this.resumeError = "The resume file is not available.";
        return;
      }
      this.resumeBlob = blob;

      const url =
        URL.createObjectURL(blob);

      preview.location.href = url;

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (error) {
      preview.close();
      this.resumeError = error instanceof Error
        ? error.message
        : "Unable to open the resume. Please try again.";
      console.error(
        "Unable to open resume:",
        error,
      );
    } finally {
      this.resumeLoading = false;
      this.cdr.markForCheck();
    }
  }

  async downloadResume(): Promise<void> {
    if (
      !this.candidate?.resumeFileId && !this.candidate?.resumeName
    ) {
      return;
    }

    this.resumeError = "";
    this.resumeLoading = true;

    try {
      const blob = this.resumeBlob ?? await this.resumeStorage.get(
        this.candidate.resumeFileId ?? "",
        this.candidate.resumeName,
        this.candidate.id,
      );

      if (!blob) {
        this.resumeAvailable = false;
        this.resumeError = "The resume file is not available.";
        return;
      }

      const url =
        URL.createObjectURL(blob);

      this.resumeBlob = blob;

      const anchor =
        document.createElement("a");

      anchor.href = url;

      anchor.download =
        this.candidate.resumeName ||
        "resume.pdf";

      document.body.appendChild(
        anchor,
      );

      anchor.click();

      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      this.resumeError = error instanceof Error
        ? error.message
        : "Unable to download the resume. Please try again.";
      console.error(
        "Unable to download resume:",
        error,
      );
    } finally {
      this.resumeLoading = false;
      this.cdr.markForCheck();
    }
  }

  async addNote(): Promise<void> {
    if (
      !this.candidate ||
      !this.note.trim()
    ) {
      return;
    }

    await this.candidateService.addNote(
      this.candidate.id,
      this.note,
    );

    this.note = "";

    this.refresh();
  }

  async addFollowUp(): Promise<void> {
    if (
      !this.candidate ||
      !this.followUpDate
    ) {
      return;
    }

    const followUp: FollowUp = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
      candidateId:
        this.candidate.id,
      candidateName:
        this.candidate.name,
      scheduledAt:
        this.followUpDate,
      notes:
        "Follow-up scheduled from candidate details",
      completed: false,
      createdBy:
        this.currentActor,
      createdAt:
        new Date().toISOString(),
    };

    await this.followUpService.add(
      followUp,
    );

    this.followUpDate = "";

    this.refresh();
  }

  activityLabel(
    type: string,
  ): string {
    return type
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase(),
      );
  }

  label(
    status: CandidateStatus,
  ): string {
    return status.replaceAll(
      "_",
      " ",
    );
  }

  private refresh(): void {
    if (!this.candidate) {
      return;
    }

    const updated =
      this.candidateService.getById(
        this.candidate.id,
      );

    this.candidate =
      updated;

    if (!this.candidate) {
      return;
    }

    this.selectedStatus =
      this.candidate.status;

    this.loadLogs(
      this.candidate.id,
    );
    this.resumeAvailable = Boolean(
      this.candidate.resumeFileId || this.candidate.resumeName,
    );
  }
}