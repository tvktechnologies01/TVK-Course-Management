import { ChangeDetectorRef, Component, OnInit, inject, Optional } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { TrainerPortalService } from "../../core/services/trainer-portal.service";

export type PortalTab = "dashboard" | "my-attendance" | "student-register" | "attendance-mark" | "attendance-history" | "students" | "leave-request" | "profile";
export type StudentRegisterSubTab = "daily" | "monthly" | "roster";

export interface AttendanceMarkRow {
  studentId: string;
  studentName: string;
  courseName: string;
  batchId?: string;
  status: "PRESENT" | "LATE" | "ABSENT";
  notes: string;
}

@Component({
  selector: "app-trainer-portal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./trainer-portal.html",
  styleUrl: "./trainer-portal.css",
})
export class TrainerPortalComponent implements OnInit {
  private readonly portalService: TrainerPortalService;
  private readonly router: Router;
  private readonly cdr: ChangeDetectorRef;

  constructor(
    @Optional() portalService?: TrainerPortalService,
    @Optional() router?: Router,
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

  activeTab: PortalTab = "dashboard";
  loading = true;
  profileData: any = null;
  errorMessage = "";

  // Unified Student Register Sub-View State ("daily" | "monthly" | "roster")
  studentRegisterSubTab: StudentRegisterSubTab = "daily";

  get isStudentRegisterActive(): boolean {
    return (
      this.activeTab === "student-register" ||
      this.activeTab === "attendance-mark" ||
      this.activeTab === "attendance-history" ||
      this.activeTab === "students"
    );
  }

  setStudentRegisterSubTab(subTab: StudentRegisterSubTab): void {
    this.studentRegisterSubTab = subTab;
    if (subTab === "daily") {
      this.setTab("attendance-mark");
    } else if (subTab === "monthly") {
      this.setTab("attendance-history");
    } else if (subTab === "roster") {
      this.setTab("students");
    }
  }

  // Attendance Marking State
  markDate = this.getTodayDateString();
  markBatchId = "ALL";
  markTopic = "";
  markRows: AttendanceMarkRow[] = [];
  isSavingAttendance = false;
  attendanceFeedback = "";
  attendanceFeedbackType: "success" | "error" = "success";

  // Attendance History & Register State
  historyMonth = this.getCurrentMonthString();
  historyBatchId = "ALL";
  historyRecords: any[] = [];
  isLoadingHistory = false;

  // Student Register / Dossier State
  studentSearchQuery = "";
  studentBatchFilter = "ALL";
  selectedStudentSummary: any = null;
  isLoadingStudentSummary = false;

  // Leave & Absence State
  leaveReason = "";
  leaveStartDate = this.getTodayDateString();
  leaveReturnDate = "";
  leaveType = "CASUAL";
  leaveHandoverNotes = "";
  isSubmittingLeave = false;
  leaveFeedbackMsg = "";
  leaveFeedbackType: "success" | "error" = "success";

  // Faculty Work Attendance & Check-In State
  todayWorkAttendance: any = null;
  isCheckingIn = false;
  checkInFeedbackMsg = "";
  checkInFeedbackType: "success" | "error" = "success";
  institutionalHolidays: any[] = [];

  // Trainer's Own Attendance Register State
  myAttendanceRangeMode: "monthly" | "weekly" = "monthly";
  myAttendanceMonth = this.getCurrentMonthString();
  myAttendanceWeekStart = "";
  myAttendanceWeekEnd = "";
  myAttendanceStats: any = null;
  myAttendanceRecords: any[] = [];
  isLoadingMyAttendance = false;
  isExportingMyAttendance = false;

  // Profile / Password State
  currentPassword = "";
  newPassword = "";
  confirmPassword = "";
  isChangingPassword = false;
  passwordFeedbackMsg = "";
  passwordFeedbackType: "success" | "error" = "success";

  get currentTabTitle(): string {
    switch (this.activeTab) {
      case "dashboard":
        return "Dashboard Overview";
      case "my-attendance":
        return "My Daily Attendance & Register";
      case "student-register":
      case "attendance-mark":
      case "attendance-history":
      case "students":
        return `Student Register — ${
          this.studentRegisterSubTab === "monthly"
            ? "Monthly Attendance Matrix"
            : this.studentRegisterSubTab === "roster"
            ? "Candidate Students Roster"
            : "Daily Attendance & Curriculum"
        }`;
      case "leave-request":
        return "Leave & Absence Management";
      case "profile":
        return "Faculty Profile & Settings";
      default:
        return "Faculty Portal";
    }
  }

  ngOnInit(): void {
    this.loadProfile();
    this.loadInstitutionalHolidays();
  }

  loadInstitutionalHolidays(): void {
    this.portalService.getHolidays().subscribe({
      next: (holidays) => {
        this.institutionalHolidays = holidays || [];
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  getHolidayForDate(dateStr: string): any | null {
    if (!dateStr || !this.institutionalHolidays?.length) return null;
    return this.institutionalHolidays.find((h) => h.date === dateStr) || null;
  }

  get isTodayHoliday(): boolean {
    const today = this.getTodayDateString();
    return Boolean(this.getHolidayForDate(today));
  }

  get todayHolidayName(): string {
    const today = this.getTodayDateString();
    const h = this.getHolidayForDate(today);
    return h ? h.name : "";
  }

  setTab(tab: PortalTab): void {
    this.activeTab = tab;
    this.errorMessage = "";
    if (tab === "attendance-mark") {
      this.studentRegisterSubTab = "daily";
      this.initMarkAttendanceRows();
    } else if (tab === "attendance-history") {
      this.studentRegisterSubTab = "monthly";
      this.loadAttendanceHistory();
    } else if (tab === "students") {
      this.studentRegisterSubTab = "roster";
    } else if (tab === "student-register") {
      if (this.studentRegisterSubTab === "monthly") {
        this.loadAttendanceHistory();
      } else if (this.studentRegisterSubTab === "daily") {
        this.initMarkAttendanceRows();
      }
    } else if (tab === "my-attendance") {
      this.loadMyAttendance();
    }
  }

  loadProfile(): void {
    this.loading = true;
    this.errorMessage = "";
    this.cdr.markForCheck();

    this.portalService.getMe().subscribe({
      next: (data) => {
        this.profileData = data;
        this.todayWorkAttendance = data.todayAttendance || null;
        this.loading = false;
        this.initMarkAttendanceRows();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.error?.message || "Failed to load faculty portal data.";
        this.cdr.markForCheck();
      },
    });
  }

  /* ----------------------------------------------------
   * SECTION 0: FACULTY WORK ATTENDANCE & CHECK-IN
   * ---------------------------------------------------- */
  checkIn(): void {
    this.isCheckingIn = true;
    this.checkInFeedbackMsg = "";
    this.cdr.markForCheck();

    this.portalService.checkIn().subscribe({
      next: (res) => {
        this.isCheckingIn = false;
        this.todayWorkAttendance = res.record || res.data;
        this.checkInFeedbackMsg = res.message || "Attendance recorded successfully! Marked Present.";
        this.checkInFeedbackType = "success";
        if (this.profileData) {
          this.profileData.todayAttendance = res.record || res.data;
          this.profileData.availability = "AVAILABLE";
        }
        if (this.activeTab === "my-attendance") {
          this.loadMyAttendance();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isCheckingIn = false;
        this.checkInFeedbackMsg = err?.error?.error?.message || "Failed to check in.";
        this.checkInFeedbackType = "error";
        this.cdr.markForCheck();
      },
    });
  }

  initWeekRange(baseDate: Date = new Date()): void {
    const d = new Date(baseDate);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    this.myAttendanceWeekStart = monday.toISOString().slice(0, 10);
    this.myAttendanceWeekEnd = saturday.toISOString().slice(0, 10);
  }

  setAttendanceRangeMode(mode: "monthly" | "weekly"): void {
    this.myAttendanceRangeMode = mode;
    if (mode === "weekly" && !this.myAttendanceWeekStart) {
      this.initWeekRange();
    }
    this.loadMyAttendance();
  }

  shiftWeek(deltaWeeks: number): void {
    const current = this.myAttendanceWeekStart ? new Date(this.myAttendanceWeekStart) : new Date();
    current.setDate(current.getDate() + (deltaWeeks * 7));
    this.initWeekRange(current);
    this.loadMyAttendance();
  }

  onWeekStartChange(val: string): void {
    if (!val) return;
    const start = new Date(val);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    this.myAttendanceWeekStart = val;
    this.myAttendanceWeekEnd = end.toISOString().slice(0, 10);
    this.loadMyAttendance();
  }

  loadMyAttendance(month?: string): void {
    if (month) {
      this.myAttendanceMonth = month;
    }
    this.isLoadingMyAttendance = true;
    this.cdr.markForCheck();

    const filters: { month?: string; startDate?: string; endDate?: string } = {};
    if (this.myAttendanceRangeMode === "monthly") {
      filters.month = this.myAttendanceMonth || this.getCurrentMonthString();
    } else {
      if (!this.myAttendanceWeekStart) {
        this.initWeekRange();
      }
      filters.startDate = this.myAttendanceWeekStart;
      filters.endDate = this.myAttendanceWeekEnd;
    }

    this.portalService.getMyAttendance(filters).subscribe({
      next: (res) => {
        this.isLoadingMyAttendance = false;
        if (res) {
          const stats = res.stats || {};
          this.myAttendanceStats = {
            totalDays: stats.totalDays ?? stats.totalWorkingDays ?? 0,
            presentDays: stats.presentDays ?? stats.presentCount ?? 0,
            leaveDays: stats.leaveDays ?? stats.leaveCount ?? 0,
            absentDays: stats.absentDays ?? stats.absentCount ?? 0,
            attendanceRate: stats.attendanceRate ?? stats.attendancePercentage ?? stats.attendancePercent ?? 0,
          };
          this.myAttendanceRecords = res.records || [];
          if (res.todayRecord) {
            this.todayWorkAttendance = res.todayRecord;
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingMyAttendance = false;
        this.cdr.markForCheck();
      },
    });
  }

  exportMyAttendanceCsv(): void {
    this.isExportingMyAttendance = true;
    this.cdr.markForCheck();

    const filters: { month?: string; startDate?: string; endDate?: string } = {};
    let filenameSuffix = "";

    if (this.myAttendanceRangeMode === "monthly") {
      filters.month = this.myAttendanceMonth || this.getCurrentMonthString();
      filenameSuffix = filters.month;
    } else {
      filters.startDate = this.myAttendanceWeekStart;
      filters.endDate = this.myAttendanceWeekEnd;
      filenameSuffix = `${this.myAttendanceWeekStart}_to_${this.myAttendanceWeekEnd}`;
    }

    this.portalService.downloadMyAttendanceCsv(filters).subscribe({
      next: (blob) => {
        this.isExportingMyAttendance = false;
        if (typeof window !== "undefined" && typeof document !== "undefined") {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const trainerName = this.profileData?.name ? this.profileData.name.replace(/\s+/g, "_") : "My";
          a.download = `Faculty_Attendance_${trainerName}_${filenameSuffix}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isExportingMyAttendance = false;
        this.cdr.markForCheck();
      },
    });
  }

  /* ----------------------------------------------------
   * SECTION 1: ATTENDANCE MARKING
   * ---------------------------------------------------- */
  initMarkAttendanceRows(): void {
    if (!this.profileData?.assignedStudents) return;
    const students: any[] = this.filteredAssignedStudentsForMarking;
    this.markRows = students.map((s) => ({
      studentId: s.id || s._id,
      studentName: s.name,
      courseName: s.courseName || s.enrolledCourse || "Course",
      batchId: s.batchId || "",
      status: "PRESENT",
      notes: "",
    }));
  }

  get filteredAssignedStudentsForMarking(): any[] {
    const list: any[] = this.profileData?.assignedStudents || [];
    if (this.markBatchId === "ALL") return list;
    return list.filter((s) => s.batchId === this.markBatchId);
  }

  onMarkBatchChange(): void {
    this.initMarkAttendanceRows();
  }

  setAllStatus(status: "PRESENT" | "LATE" | "ABSENT"): void {
    this.markRows.forEach((r) => (r.status = status));
  }

  getStatusCount(status: "PRESENT" | "LATE" | "ABSENT"): number {
    return this.markRows.filter((r) => r.status === status).length;
  }

  saveAttendance(): void {
    if (!this.markDate) {
      this.setAttendanceFeedback("Please select a session date.", "error");
      return;
    }
    if (this.markRows.length === 0) {
      this.setAttendanceFeedback("No students to mark attendance for.", "error");
      return;
    }

    this.isSavingAttendance = true;
    this.attendanceFeedback = "";

    const payload = this.markRows.map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      batchId: r.batchId || (this.markBatchId !== "ALL" ? this.markBatchId : undefined),
      courseName: r.courseName,
      date: this.markDate,
      status: r.status,
      notes: r.notes.trim() || undefined,
      topicCovered: this.markTopic.trim() || undefined,
    }));

    this.portalService.markAttendance(payload).subscribe({
      next: (res) => {
        this.isSavingAttendance = false;
        this.setAttendanceFeedback(res.message || `Successfully marked attendance for ${res.count} candidates!`, "success");
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingAttendance = false;
        this.setAttendanceFeedback(err?.error?.error?.message || "Failed to record attendance.", "error");
        this.cdr.markForCheck();
      },
    });
  }

  private setAttendanceFeedback(msg: string, type: "success" | "error"): void {
    this.attendanceFeedback = msg;
    this.attendanceFeedbackType = type;
    this.cdr.markForCheck();
  }

  /* ----------------------------------------------------
   * SECTION 2: ATTENDANCE HISTORY & REGISTER
   * ---------------------------------------------------- */
  loadAttendanceHistory(): void {
    this.isLoadingHistory = true;
    this.portalService
      .getAttendance({
        month: this.historyMonth,
        batchId: this.historyBatchId !== "ALL" ? this.historyBatchId : undefined,
      })
      .subscribe({
        next: (data) => {
          this.historyRecords = data;
          this.isLoadingHistory = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoadingHistory = false;
          this.errorMessage = err?.error?.error?.message || "Failed to load past attendance records.";
          this.cdr.markForCheck();
        },
      });
  }

  get historyDaysInMonth(): number[] {
    if (!this.historyMonth) return [];
    const [year, month] = this.historyMonth.split("-").map(Number);
    const count = new Date(year, month, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  get historyMatrixRows(): Array<{
    studentId: string;
    studentName: string;
    courseName: string;
    dayStatus: Record<number, string>;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    totalSessions: number;
    percent: number;
  }> {
    const students: any[] = this.profileData?.assignedStudents || [];
    const map = new Map<string, {
      studentId: string;
      studentName: string;
      courseName: string;
      dayStatus: Record<number, string>;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      totalSessions: number;
      percent: number;
    }>();

    students.forEach((s) => {
      const sid = s.id || s._id;
      map.set(sid, {
        studentId: sid,
        studentName: s.name,
        courseName: s.courseName || s.enrolledCourse || "Course",
        dayStatus: {},
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        totalSessions: 0,
        percent: 100,
      });
    });

    this.historyRecords.forEach((r) => {
      let row = map.get(r.studentId);
      if (!row) {
        row = {
          studentId: r.studentId,
          studentName: r.studentName,
          courseName: r.courseName || "Course",
          dayStatus: {},
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          totalSessions: 0,
          percent: 100,
        };
        map.set(r.studentId, row);
      }

      if (r.date && r.date.startsWith(this.historyMonth)) {
        const day = parseInt(r.date.split("-")[2], 10);
        if (!isNaN(day)) {
          row.dayStatus[day] = r.status;
          row.totalSessions++;
          if (r.status === "PRESENT") row.presentCount++;
          else if (r.status === "LATE") row.lateCount++;
          else if (r.status === "ABSENT") row.absentCount++;
        }
      }
    });

    const rows = Array.from(map.values());
    rows.forEach((r) => {
      if (r.totalSessions > 0) {
        r.percent = Math.round(((r.presentCount + r.lateCount) / r.totalSessions) * 100);
      }
    });

    return rows;
  }

  exportHistoryCsv(): void {
    const days = this.historyDaysInMonth;
    const header = ["Student ID", "Candidate Name", "Course", ...days.map((d) => `Day ${d}`), "Total Sessions", "Present", "Late", "Absent", "Attendance %"];
    const rows = this.historyMatrixRows.map((r) => [
      `"${r.studentId}"`,
      `"${r.studentName}"`,
      `"${r.courseName}"`,
      ...days.map((d) => `"${r.dayStatus[d] || '-'}"`),
      r.totalSessions,
      r.presentCount,
      r.lateCount,
      r.absentCount,
      `"${r.percent}%"`,
    ]);

    const csvContent = [header.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Trainer_Attendance_${this.historyMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ----------------------------------------------------
   * SECTION 3: CANDIDATE REGISTER & DOSSIER
   * ---------------------------------------------------- */
  get filteredStudents(): any[] {
    let list: any[] = this.profileData?.assignedStudents || [];
    if (this.studentBatchFilter !== "ALL") {
      list = list.filter((s) => s.batchId === this.studentBatchFilter);
    }
    if (this.studentSearchQuery.trim()) {
      const q = this.studentSearchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.id?.toLowerCase().includes(q) ||
          s._id?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.phone?.includes(q)
      );
    }
    return list;
  }

  viewStudentSummary(studentId: string): void {
    this.isLoadingStudentSummary = true;
    this.selectedStudentSummary = null;
    this.portalService.getStudentSummary(studentId).subscribe({
      next: (data) => {
        this.selectedStudentSummary = data;
        this.isLoadingStudentSummary = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingStudentSummary = false;
        this.cdr.markForCheck();
      },
    });
  }

  closeStudentSummary(): void {
    this.selectedStudentSummary = null;
  }

  /* ----------------------------------------------------
   * SECTION 4: LEAVE & ABSENCE MANAGEMENT
   * ---------------------------------------------------- */
  submitLeaveRequest(): void {
    if (!this.leaveReason.trim()) {
      this.setLeaveFeedback("Please enter a reason for your absence / leave.", "error");
      return;
    }

    this.isSubmittingLeave = true;
    this.leaveFeedbackMsg = "";

    this.portalService
      .submitAbsence({
        leaveType: this.leaveType,
        absenceReason: this.leaveReason.trim(),
        absenceStartDate: this.leaveStartDate,
        expectedReturnDate: this.leaveReturnDate || undefined,
        handoverNotes: this.leaveHandoverNotes.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmittingLeave = false;
          this.setLeaveFeedback(res.message || "Leave registered! Management dashboard notified.", "success");
          this.leaveReason = "";
          this.leaveHandoverNotes = "";
          this.loadProfile();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmittingLeave = false;
          this.setLeaveFeedback(err?.error?.error?.message || "Failed to submit leave request.", "error");
          this.cdr.markForCheck();
        },
      });
  }

  resumeDuties(): void {
    this.isSubmittingLeave = true;
    this.portalService.resumeWork().subscribe({
      next: (res) => {
        this.isSubmittingLeave = false;
        this.setLeaveFeedback(res.message || "Status updated to Available! Welcome back.", "success");
        this.loadProfile();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSubmittingLeave = false;
        this.setLeaveFeedback(err?.error?.error?.message || "Failed to resume work status.", "error");
        this.cdr.markForCheck();
      },
    });
  }

  private setLeaveFeedback(msg: string, type: "success" | "error"): void {
    this.leaveFeedbackMsg = msg;
    this.leaveFeedbackType = type;
    this.cdr.markForCheck();
  }

  /* ----------------------------------------------------
   * SECTION 6: PROFILE & PASSWORD CHANGE
   * ---------------------------------------------------- */
  changePassword(): void {
    if (!this.currentPassword || !this.newPassword) {
      this.passwordFeedbackMsg = "Both current and new password are required.";
      this.passwordFeedbackType = "error";
      return;
    }
    if (this.newPassword.length < 8) {
      this.passwordFeedbackMsg = "New password must be at least 8 characters long.";
      this.passwordFeedbackType = "error";
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordFeedbackMsg = "New password and confirmation password do not match.";
      this.passwordFeedbackType = "error";
      return;
    }

    this.isChangingPassword = true;
    this.passwordFeedbackMsg = "";

    this.portalService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.isChangingPassword = false;
        this.passwordFeedbackMsg = "Password updated successfully!";
        this.passwordFeedbackType = "success";
        this.currentPassword = "";
        this.newPassword = "";
        this.confirmPassword = "";
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isChangingPassword = false;
        this.passwordFeedbackMsg = err?.error?.error?.message || "Failed to change password.";
        this.passwordFeedbackType = "error";
        this.cdr.markForCheck();
      },
    });
  }

  logout(): void {
    this.portalService.logout();
    void this.router.navigateByUrl("/trainer-login");
  }

  /* Helper utilities */
  private getTodayDateString(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  private getCurrentMonthString(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }
}
