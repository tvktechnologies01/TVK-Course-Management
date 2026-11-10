import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { TrainerService } from "../../core/services/trainer.service";
import { CourseService } from "../../core/services/course.service";
import {
  Trainer,
  TrainerOverview,
  CourseAllocationItem,
  EligibleStudent,
  AutoAllocationPreview,
  TrainerAllocationHistory,
  AbsenceImpactData,
  TrainerAvailabilityStatus,
  TrainerStatus,
  TrainerEmploymentType,
  TrainerBatch,
  TrainerAttendance,
  StudentScorecard,
  AbsentTrainerAlert,
  MonthlyStudentAttendanceRow,
  FacultyRegisterMatrixRow,
  InstitutionalHoliday,
  BatchScheduleCalculation,
} from "../../core/models/trainer.model";
import { Course } from "../../core/models/course.model";

export type TrainerTab =
  | "overview"
  | "trainers"
  | "batches"
  | "courses"
  | "students"
  | "attendance"
  | "availability"
  | "history";

@Component({
  selector: "app-trainer-management",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./trainer-management.html",
  styleUrl: "./trainer-management.css",
})
export class TrainerManagementComponent implements OnInit {
  // Active internal view
  selectedTab: TrainerTab = "overview";
  loading = false;
  notificationMessage = "";
  notificationType: "success" | "error" | "info" = "info";

  // Overview data
  overview: TrainerOverview | null = null;

  // Active courses from CourseService
  activeCourses: Course[] = [];

  // Trainer Directory
  trainers: Trainer[] = [];
  trainerSearch = "";
  trainerStatusFilter = "ALL";
  trainerAvailabilityFilter = "ALL";
  trainerEmploymentFilter = "ALL";
  trainerCourseFilter = "ALL";

  // Trainer Modal (Add / Edit)
  showTrainerModal = false;
  isEditingTrainer = false;
  trainerFormId = "";
  trainerForm: {
    name: string;
    email: string;
    phone: string;
    qualification: string;
    specialization: string;
    skillsString: string;
    qualifiedCourses: string[];
    employmentType: TrainerEmploymentType;
    maxCapacity: number;
    availability: TrainerAvailabilityStatus;
    status: TrainerStatus;
    hourlyRate: number;
    contractTerms: string;
    documentName: string;
    documentUrl: string;
    notes: string;
  } = this.getEmptyTrainerForm();
  trainerFormError = "";
  trainerFormSaving = false;

  // Trainer Profile Modal
  showProfileModal = false;
  selectedTrainerProfile: Trainer | null = null;
  profileAssignedStudents: any[] = [];
  profileAssignedCourses: any[] = [];
  loadingProfile = false;

  // Trainer Student Roster Modal (Phase 1)
  showTrainerRosterModal = false;
  selectedRosterTrainer: Trainer | null = null;
  rosterStudents: EligibleStudent[] = [];
  loadingRoster = false;

  // Student 360 Detail Modal (Phase 1)
  showStudentDetailModal = false;
  studentDetailSummary: any = null;
  loadingStudentDetail = false;
  studentDetailError = "";

  // Batch & Schedule Management
  batches: TrainerBatch[] = [];
  batchSearch = "";
  batchStatusFilter = "ALL";
  showBatchModal = false;
  isEditingBatch = false;
  batchFormId = "";
  batchForm: {
    batchName: string;
    courseName: string;
    trainerId: string;
    timeSlot: string;
    days: string[];
    meetingLink: string;
    classroomLocation: string;
    startDate: string;
    endDate: string;
    totalSessions: number;
    status: "UPCOMING" | "ACTIVE" | "COMPLETED";
    notes: string;
  } = this.getEmptyBatchForm();
  batchFormSaving = false;
  batchFormError = "";
  batchScheduleCalc: BatchScheduleCalculation | null = null;
  calculatingBatchSchedule = false;

  // Institutional Holidays Master
  institutionalHolidays: InstitutionalHoliday[] = [];
  showHolidaysModal = false;
  loadingHolidays = false;
  holidayForm = {
    date: new Date().toISOString().slice(0, 10),
    name: "",
    type: "GOVERNMENT" as "GOVERNMENT" | "INSTITUTIONAL" | "FESTIVAL" | "OTHER",
    description: "",
  };
  savingHoliday = false;
  holidayError = "";

  // Course Allocations
  courseAllocations: CourseAllocationItem[] = [];
  courseSearch = "";
  selectedCourseForAllocation: CourseAllocationItem | null = null;
  showCourseAllocationModal = false;
  courseAllocationForm: {
    primaryTrainerId: string;
    backupTrainerIds: string[];
    notes: string;
  } = { primaryTrainerId: "", backupTrainerIds: [], notes: "" };
  courseAllocationSaving = false;
  courseAllocationError = "";

  // Student Allocations
  students: EligibleStudent[] = [];
  studentSearch = "";
  studentCourseFilter = "ALL";
  studentTrainerFilter = "ALL";
  studentAllocationFilter: "ALL" | "ASSIGNED" | "UNASSIGNED" = "ALL";
  selectedStudentIds = new Set<string>();

  // Single Student Allocation Modal
  showSingleAllocateModal = false;
  targetStudentForAllocation: EligibleStudent | null = null;
  singleAllocateTargetTrainerId = "";
  singleAllocateReason = "";
  singleAllocateSaving = false;
  singleAllocateError = "";

  // Bulk Student Allocation Modal
  showBulkAllocateModal = false;
  bulkAllocateTargetTrainerId = "";
  bulkAllocateReason = "";
  bulkAllocateSaving = false;
  bulkAllocateError = "";

  // Auto Allocate Modal
  showAutoAllocateModal = false;
  autoAllocationPreview: AutoAllocationPreview | null = null;
  loadingAutoAllocate = false;
  applyingAutoAllocate = false;
  autoAllocateError = "";

  // Attendance Tracking
  attendanceDate = new Date().toISOString().slice(0, 10);
  attendanceCourseFilter = "ALL";
  attendanceTrainerFilter = "ALL";
  attendanceBatchFilter = "";
  attendanceItems: Array<{
    studentId: string;
    studentName: string;
    courseName: string;
    trainerId: string;
    trainerName: string;
    status: "PRESENT" | "ABSENT" | "LATE";
    topicCovered: string;
    remarks: string;
  }> = [];
  topicCoveredToday = "";
  attendanceSaving = false;

  // Saved Attendance Register & Audit History (Phase 1)
  savedAttendanceRecords: TrainerAttendance[] = [];
  savedAttendanceDateFilter = "";
  savedAttendanceTrainerFilter = "ALL";
  savedAttendanceCourseFilter = "ALL";
  savedAttendanceSearch = "";
  loadingSavedAttendance = false;

  // Attendance Sub-Views (Daily Marker vs. Monthly Register Matrix vs. Date-wise Archive vs. Faculty Register)
  attendanceSubView: "DAILY_LOGGER" | "MONTHLY_REGISTER" | "DATE_ARCHIVE" | "FACULTY_REGISTER" = "MONTHLY_REGISTER";
  selectedRegisterMonth: string = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  registerCourseFilter = "ALL";
  registerTrainerFilter = "ALL";
  registerRiskFilter: "ALL" | "AT_RISK" | "CONSECUTIVE_ABSENT" = "ALL";
  registerDisplayMode: "MATRIX" | "SUMMARY" = "MATRIX";
  loadingMonthlyRegister = false;
  monthlyAttendanceRecords: TrainerAttendance[] = [];
  monthlyRegisterRows: MonthlyStudentAttendanceRow[] = [];
  daysInSelectedMonth: number[] = [];

  // Faculty Attendance Register (History & CSV Export)
  facultyHistoryRangeMode: "monthly" | "weekly" = "monthly";
  facultyHistoryMonth: string = new Date().toISOString().slice(0, 7);
  facultyHistoryWeekStart: string = "";
  facultyHistoryWeekEnd: string = "";
  facultyHistoryTrainerFilter: string = "ALL";
  facultyHistoryStats: {
    totalDays: number;
    presentDays: number;
    leaveDays: number;
    absentDays: number;
    attendancePercentage: number;
  } | null = null;
  facultyHistoryRecords: any[] = [];
  loadingFacultyHistory = false;
  exportingFacultyHistoryCsv = false;
  facultyRegisterDisplayMode: "MONTHLY_MATRIX" | "WEEKLY_MATRIX" | "DAILY_LOG" = "MONTHLY_MATRIX";
  facultyRegisterCourseFilter = "ALL";
  facultyAllocationMatrixRows: FacultyRegisterMatrixRow[] = [];
  filteredFacultyAllocationMatrixRows: FacultyRegisterMatrixRow[] = [];
  facultyWeekDays: Array<{ date: string; dayNum: number; dayName: string; isToday: boolean }> = [];
  checkingInFacultyId: string | null = null;

  // Date-wise Archive
  selectedArchiveDate: string = new Date().toISOString().slice(0, 10);
  archiveRecords: TrainerAttendance[] = [];
  loadingDateArchive = false;

  // Student Performance & Scorecard Modal
  scorecards: StudentScorecard[] = [];
  showScorecardModal = false;
  scorecardSaving = false;
  scorecardError = "";
  scorecardTargetStudent: EligibleStudent | null = null;
  scorecardForm: {
    technicalScore: number;
    problemSolvingScore: number;
    communicationScore: number;
    readinessStatus: "READY" | "NEEDS_IMPROVEMENT" | "NOT_READY";
    feedback: string;
    recommendedRole: string;
  } = {
    technicalScore: 8,
    problemSolvingScore: 8,
    communicationScore: 8,
    readinessStatus: "READY",
    feedback: "",
    recommendedRole: "",
  };

  // Availability & Absence Management
  showAvailabilityModal = false;
  targetTrainerForAvailability: Trainer | null = null;
  availabilityForm: {
    availability: TrainerAvailabilityStatus;
    absenceStartDate: string;
    expectedReturnDate: string;
    absenceReason: string;
  } = { availability: "AVAILABLE", absenceStartDate: "", expectedReturnDate: "", absenceReason: "" };
  absenceImpact: AbsenceImpactData | null = null;
  loadingAbsenceImpact = false;
  availabilitySaving = false;
  availabilityError = "";

  // Absence Reassignment Mapping (studentId -> targetTrainerId)
  absenceReassignments: Record<string, string> = {};
  showAbsenceReassignConfirmModal = false;
  absenceReassignReason = "";
  absenceReassignSaving = false;

  // Allocation History
  historyRecords: TrainerAllocationHistory[] = [];
  historySearch = "";
  historyCourseFilter = "ALL";
  historyActionFilter = "ALL";
  loadingHistory = false;

  // Faculty Work Attendance & Daily Absence Alerts
  facultyAttendanceDate = new Date().toISOString().slice(0, 10);
  facultyAttendanceOverview: any = null;
  loadingFacultyAttendance = false;
  acknowledgingTrainerId = "";
  markingAbsentTrainerId = "";
  checkingInTrainerId = "";
  selectedBackupTrainerMap: Record<string, string> = {};

  constructor(
    private readonly trainerService: TrainerService,
    private readonly courseService: CourseService,
    private readonly cdr: ChangeDetectorRef,
    private readonly route?: ActivatedRoute
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.route?.queryParamMap) {
      this.route.queryParamMap.subscribe((params) => {
        const tab = params.get("tab");
        const sub = params.get("sub");
        if (tab === "attendance") {
          this.selectedTab = "attendance";
          if (sub === "faculty") {
            this.attendanceSubView = "FACULTY_REGISTER";
          } else if (sub === "monthly") {
            this.attendanceSubView = "MONTHLY_REGISTER";
          }
          this.loadFacultyAttendanceHistory();
          this.cdr.markForCheck();
        }
      });
    }

    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      await Promise.allSettled([
        this.loadOverview(),
        this.loadFacultyDailyAttendance(),
        this.loadTrainers(),
        this.loadCourses(),
        this.loadBatches(),
        this.loadInstitutionalHolidays(),
        this.loadCourseAllocations(),
        this.loadStudents(),
        this.loadHistory(),
        this.loadScorecards(),
        this.loadSavedAttendance(),
        this.loadMonthlyRegister(),
      ]);
      this.initAttendanceGrid();
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadFacultyDailyAttendance(date?: string): Promise<void> {
    if (date) this.facultyAttendanceDate = date;
    this.loadingFacultyAttendance = true;
    this.cdr.markForCheck();
    try {
      this.facultyAttendanceOverview = await this.trainerService.getFacultyDailyAttendance(this.facultyAttendanceDate);
      if (this.facultyAttendanceOverview && !this.facultyAttendanceOverview.stats) {
        this.facultyAttendanceOverview.stats = {
          totalFaculty: this.facultyAttendanceOverview.totalActiveTrainers || 0,
          present: this.facultyAttendanceOverview.presentCount || 0,
          onLeave: this.facultyAttendanceOverview.onLeaveCount || 0,
          absent: this.facultyAttendanceOverview.absentOrNotCheckedInCount || 0,
        };
      }
      // Preselect first backup trainer if available
      if (this.facultyAttendanceOverview?.alerts) {
        for (const alert of this.facultyAttendanceOverview.alerts) {
          if (!this.selectedBackupTrainerMap[alert.trainerId] && alert.backupOptions?.length > 0) {
            this.selectedBackupTrainerMap[alert.trainerId] = alert.backupOptions[0].trainerId;
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to load faculty daily attendance:", err);
    } finally {
      this.loadingFacultyAttendance = false;
      this.cdr.markForCheck();
    }
  }

  async markTrainerAbsent(trainerId: string): Promise<void> {
    this.markingAbsentTrainerId = trainerId;
    this.acknowledgingTrainerId = trainerId;
    this.cdr.markForCheck();
    const backupId = this.selectedBackupTrainerMap[trainerId] || undefined;
    try {
      await this.trainerService.acknowledgeFacultyAbsence(trainerId, this.facultyAttendanceDate, backupId);
      this.showNotification("Trainer successfully marked ABSENT for today.", "success");
      await this.loadFacultyDailyAttendance();
      await this.loadOverview();
    } catch (err: any) {
      this.showNotification(err?.message || "Failed to mark trainer as absent.", "error");
    } finally {
      this.markingAbsentTrainerId = "";
      this.acknowledgingTrainerId = "";
      this.cdr.markForCheck();
    }
  }

  async acknowledgeAbsence(trainerId: string): Promise<void> {
    return this.markTrainerAbsent(trainerId);
  }

  async markTrainerPresent(trainerId: string): Promise<void> {
    this.checkingInTrainerId = trainerId;
    this.cdr.markForCheck();
    try {
      const res = await this.trainerService.managerCheckInTrainer(trainerId);
      this.showNotification(res?.message || "Trainer successfully marked PRESENT for today!", "success");
      await this.loadFacultyDailyAttendance();
      await this.loadOverview();
    } catch (err: any) {
      this.showNotification(err?.message || "Failed to record trainer check-in.", "error");
    } finally {
      this.checkingInTrainerId = "";
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // FACULTY ATTENDANCE REGISTER & CSV EXPORT
  // ==========================================
  initFacultyWeekRange(baseDate: Date = new Date()): void {
    const d = new Date(baseDate);
    const day = d.getDay();
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diffToMonday));
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    this.facultyHistoryWeekStart = monday.toISOString().slice(0, 10);
    this.facultyHistoryWeekEnd = saturday.toISOString().slice(0, 10);
  }

  setFacultyHistoryRangeMode(mode: "monthly" | "weekly"): void {
    this.facultyHistoryRangeMode = mode;
    this.facultyRegisterDisplayMode = mode === "weekly" ? "WEEKLY_MATRIX" : "MONTHLY_MATRIX";
    if (mode === "weekly" && !this.facultyHistoryWeekStart) {
      this.initFacultyWeekRange();
    }
    this.loadFacultyAttendanceHistory();
  }

  setFacultyRegisterDisplayMode(mode: "MONTHLY_MATRIX" | "WEEKLY_MATRIX" | "DAILY_LOG"): void {
    this.facultyRegisterDisplayMode = mode;
    if (mode === "WEEKLY_MATRIX") {
      this.facultyHistoryRangeMode = "weekly";
      if (!this.facultyHistoryWeekStart) this.initFacultyWeekRange();
      this.loadFacultyAttendanceHistory();
    } else if (mode === "MONTHLY_MATRIX") {
      this.facultyHistoryRangeMode = "monthly";
      this.loadFacultyAttendanceHistory();
    }
    this.cdr.markForCheck();
  }

  shiftFacultyWeek(deltaWeeks: number): void {
    const current = this.facultyHistoryWeekStart ? new Date(this.facultyHistoryWeekStart) : new Date();
    current.setDate(current.getDate() + (deltaWeeks * 7));
    this.initFacultyWeekRange(current);
    this.loadFacultyAttendanceHistory();
  }

  onFacultyWeekStartChange(val: string): void {
    if (!val) return;
    const start = new Date(val);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    this.facultyHistoryWeekStart = val;
    this.facultyHistoryWeekEnd = end.toISOString().slice(0, 10);
    this.loadFacultyAttendanceHistory();
  }

  async quickCheckInTrainer(trainerId: string): Promise<void> {
    this.checkingInFacultyId = trainerId;
    this.cdr.markForCheck();
    try {
      const res = await this.trainerService.managerCheckInTrainer(trainerId);
      this.showNotification(res.message || "Trainer checked in successfully!", "success");
      await this.loadFacultyAttendanceHistory();
    } catch (err: any) {
      this.showNotification(err?.message || "Failed to check in trainer.", "error");
    } finally {
      this.checkingInFacultyId = null;
      this.cdr.markForCheck();
    }
  }

  filterFacultyAllocationMatrix(): void {
    let rows = [...this.facultyAllocationMatrixRows];
    if (this.facultyHistoryTrainerFilter && this.facultyHistoryTrainerFilter !== "ALL") {
      rows = rows.filter((r) => r.trainerId === this.facultyHistoryTrainerFilter);
    }
    if (this.facultyRegisterCourseFilter && this.facultyRegisterCourseFilter !== "ALL") {
      const cFilter = this.facultyRegisterCourseFilter.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.assignedCourses.some((c) => c.toLowerCase().includes(cFilter)) ||
          r.courseTrackDisplay.toLowerCase().includes(cFilter)
      );
    }
    this.filteredFacultyAllocationMatrixRows = rows;
    this.cdr.markForCheck();
  }

  buildFacultyAllocationMatrix(): void {
    if (!this.trainers || !this.trainers.length) {
      this.facultyAllocationMatrixRows = [];
      this.filteredFacultyAllocationMatrixRows = [];
      return;
    }

    const trainerBatchesMap = new Map<string, string[]>();
    for (const b of this.batches) {
      if (b.trainerId) {
        const arr = trainerBatchesMap.get(b.trainerId) || [];
        arr.push(b.batchName);
        trainerBatchesMap.set(b.trainerId, arr);
      }
    }

    const trainerStudentsMap = new Map<string, string[]>();
    for (const s of this.students) {
      if (s.trainerId) {
        const arr = trainerStudentsMap.get(s.trainerId) || [];
        arr.push(s.name);
        trainerStudentsMap.set(s.trainerId, arr);
      }
    }

    const facultyRecordsMap = new Map<string, Map<string, any>>();
    for (const rec of this.facultyHistoryRecords) {
      if (!rec.trainerId || !rec.date) continue;
      const m = facultyRecordsMap.get(rec.trainerId) || new Map<string, any>();
      m.set(rec.date, rec);
      facultyRecordsMap.set(rec.trainerId, m);
    }

    const trainerSessionDates = new Map<string, Map<string, { topic: string; count: number }>>();
    for (const sRec of this.monthlyAttendanceRecords) {
      if (!sRec.date) continue;
      const tId = sRec.trainerId;
      if (tId) {
        const m = trainerSessionDates.get(tId) || new Map();
        const prev = m.get(sRec.date) || { topic: sRec.topicCovered || "", count: 0 };
        prev.count++;
        if (sRec.topicCovered && !prev.topic) prev.topic = sRec.topicCovered;
        m.set(sRec.date, prev);
        trainerSessionDates.set(tId, m);
      }
    }

    const holidayMap = new Map<string, string>();
    for (const h of this.institutionalHolidays) {
      holidayMap.set(h.date, h.name);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const [curYear, curMonth] = (this.facultyHistoryMonth || todayStr.slice(0, 7)).split("-").map(Number);

    if (this.facultyHistoryWeekStart) {
      const daysArr: Array<{ date: string; dayNum: number; dayName: string; isToday: boolean }> = [];
      const d = new Date(this.facultyHistoryWeekStart);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 0; i < 7; i++) {
        const dateStr = d.toISOString().slice(0, 10);
        daysArr.push({
          date: dateStr,
          dayNum: d.getDate(),
          dayName: dayNames[d.getDay()],
          isToday: dateStr === todayStr,
        });
        d.setDate(d.getDate() + 1);
      }
      this.facultyWeekDays = daysArr;
    }

    const activeTrainers = this.trainers.filter((t) => t.status === "ACTIVE");

    this.facultyAllocationMatrixRows = activeTrainers.map((t) => {
      const assignedBatches = trainerBatchesMap.get(t.id) || [];
      const assignedStudents = trainerStudentsMap.get(t.id) || [];
      const courses =
        t.assignedCourses && t.assignedCourses.length > 0
          ? t.assignedCourses
          : t.qualifiedCourses || [];
      const courseTrackDisplay = courses.join(", ") || "General Training";
      const batchDisplay =
        assignedBatches.length > 0
          ? assignedBatches.join(", ")
          : assignedStudents.length
          ? `${assignedStudents.length} Students Assigned`
          : "Direct Faculty";
      const studentCount = assignedStudents.length || t.currentStudentCount || 0;

      const fMap = facultyRecordsMap.get(t.id) || new Map<string, any>();
      const sMap = trainerSessionDates.get(t.id) || new Map<string, any>();

      const dayStatuses: Record<number, {
        status: "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "PENDING";
        checkInTime?: string;
        topic?: string;
        remarks?: string;
        date: string;
      }> = {};

      const dateStatuses: Record<string, {
        status: "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "PENDING";
        checkInTime?: string;
        topic?: string;
        remarks?: string;
        date: string;
      }> = {};

      let presentCount = 0;
      let leaveCount = 0;
      let absentCount = 0;
      let totalHeld = 0;

      const totalMonthDays = new Date(curYear, curMonth, 0).getDate();

      for (let day = 1; day <= totalMonthDays; day++) {
        const dateStr = `${curYear}-${String(curMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayDate = new Date(curYear, curMonth - 1, day);
        const isSunday = dayDate.getDay() === 0;
        const isHoliday = holidayMap.has(dateStr);
        const isPast = dateStr < todayStr;
        const isToday = dateStr === todayStr;

        const facRec = fMap.get(dateStr);
        const sessionInfo = sMap.get(dateStr);

        let cellStat: {
          status: "PRESENT" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "PENDING";
          checkInTime?: string;
          topic?: string;
          remarks?: string;
          date: string;
        };

        if (facRec) {
          if (facRec.status === "PRESENT") {
            cellStat = {
              status: "PRESENT",
              checkInTime: facRec.checkInTime ? new Date(facRec.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
              topic: sessionInfo?.topic || facRec.handoverNotes || "",
              remarks: facRec.handoverNotes || "",
              date: dateStr,
            };
            presentCount++;
            totalHeld++;
          } else if (facRec.status === "ON_LEAVE") {
            cellStat = {
              status: "ON_LEAVE",
              topic: facRec.leaveType || "LEAVE",
              remarks: facRec.leaveReason || "",
              date: dateStr,
            };
            leaveCount++;
            totalHeld++;
          } else {
            cellStat = {
              status: "ABSENT",
              remarks: "Marked Absent",
              date: dateStr,
            };
            absentCount++;
            totalHeld++;
          }
        } else if (sessionInfo && sessionInfo.count > 0) {
          cellStat = {
            status: "PRESENT",
            topic: sessionInfo.topic || "Class session held",
            date: dateStr,
          };
          presentCount++;
          totalHeld++;
        } else if (isHoliday) {
          cellStat = {
            status: "HOLIDAY",
            remarks: holidayMap.get(dateStr) || "Institutional Holiday",
            date: dateStr,
          };
        } else if (isSunday) {
          cellStat = {
            status: "HOLIDAY",
            remarks: "Sunday / Weekly Off",
            date: dateStr,
          };
        } else if (isPast) {
          cellStat = {
            status: "ABSENT",
            remarks: "Uninformed Absence",
            date: dateStr,
          };
          absentCount++;
          totalHeld++;
        } else if (isToday) {
          cellStat = {
            status: "PENDING",
            remarks: "Pending Check-In",
            date: dateStr,
          };
        } else {
          cellStat = {
            status: "PENDING",
            remarks: "Scheduled Day",
            date: dateStr,
          };
        }

        dayStatuses[day] = cellStat;
        dateStatuses[dateStr] = cellStat;
      }

      if (this.facultyWeekDays && this.facultyWeekDays.length) {
        for (const wd of this.facultyWeekDays) {
          if (!dateStatuses[wd.date]) {
            const facRec = fMap.get(wd.date);
            const sessionInfo = sMap.get(wd.date);
            const isHoliday = holidayMap.has(wd.date);
            const dObj = new Date(wd.date);
            const isSunday = dObj.getDay() === 0;
            const isPast = wd.date < todayStr;

            let cellStat: any;
            if (facRec && facRec.status === "PRESENT") {
              cellStat = { status: "PRESENT", date: wd.date, topic: sessionInfo?.topic || facRec.handoverNotes || "" };
            } else if (facRec && facRec.status === "ON_LEAVE") {
              cellStat = { status: "ON_LEAVE", date: wd.date, remarks: facRec.leaveReason || "" };
            } else if (facRec && facRec.status === "ABSENT") {
              cellStat = { status: "ABSENT", date: wd.date };
            } else if (sessionInfo && sessionInfo.count > 0) {
              cellStat = { status: "PRESENT", date: wd.date, topic: sessionInfo.topic };
            } else if (isHoliday || isSunday) {
              cellStat = { status: "HOLIDAY", date: wd.date, remarks: holidayMap.get(wd.date) || "Holiday" };
            } else if (isPast) {
              cellStat = { status: "ABSENT", date: wd.date, remarks: "Uninformed Absence" };
            } else {
              cellStat = { status: "PENDING", date: wd.date };
            }
            dateStatuses[wd.date] = cellStat;
          }
        }
      }

      const convertedLeaveDays = Math.floor(absentCount / 3);
      const activeStrikes = absentCount % 3;
      const attendancePercent = totalHeld > 0 ? Math.round((presentCount / totalHeld) * 100) : 100;
      const todayCell = dateStatuses[todayStr];
      const todayStatus = todayCell ? todayCell.status : "PENDING";

      return {
        trainerId: t.id,
        trainerName: t.name,
        email: t.email,
        assignedCourses: courses,
        courseTrackDisplay,
        batchNames: assignedBatches,
        batchDisplay,
        studentCount,
        dayStatuses,
        dateStatuses,
        totalHeld,
        presentCount,
        leaveCount,
        absentCount,
        convertedLeaveDays,
        activeStrikes,
        attendancePercent,
        todayStatus,
        todayCheckInTime: fMap.get(todayStr)?.checkInTime,
      };
    });

    this.filterFacultyAllocationMatrix();
  }

  async loadFacultyAttendanceHistory(): Promise<void> {
    this.loadingFacultyHistory = true;
    this.cdr.markForCheck();
    try {
      const filters: any = {};
      if (this.facultyHistoryTrainerFilter && this.facultyHistoryTrainerFilter !== "ALL") {
        filters.trainerId = this.facultyHistoryTrainerFilter;
      }

      if (this.facultyHistoryRangeMode === "monthly") {
        filters.month = this.facultyHistoryMonth || new Date().toISOString().slice(0, 7);
      } else {
        if (!this.facultyHistoryWeekStart) {
          this.initFacultyWeekRange();
        }
        filters.startDate = this.facultyHistoryWeekStart;
        filters.endDate = this.facultyHistoryWeekEnd;
      }

      const res = await this.trainerService.getFacultyAttendanceHistory(filters);
      if (res) {
        this.facultyHistoryStats = res.stats;
        this.facultyHistoryRecords = res.records || [];
      }
      this.buildFacultyAllocationMatrix();
    } catch (err) {
      console.error("Failed to load faculty attendance history:", err);
    } finally {
      this.loadingFacultyHistory = false;
      this.cdr.markForCheck();
    }
  }

  async exportFacultyHistoryCsv(): Promise<void> {
    this.exportingFacultyHistoryCsv = true;
    this.cdr.markForCheck();

    const filters: any = {};
    if (this.facultyHistoryTrainerFilter && this.facultyHistoryTrainerFilter !== "ALL") {
      filters.trainerId = this.facultyHistoryTrainerFilter;
    }

    let filenameSuffix = "";
    if (this.facultyHistoryRangeMode === "monthly") {
      filters.month = this.facultyHistoryMonth || new Date().toISOString().slice(0, 7);
      filenameSuffix = filters.month;
    } else {
      filters.startDate = this.facultyHistoryWeekStart;
      filters.endDate = this.facultyHistoryWeekEnd;
      filenameSuffix = `${this.facultyHistoryWeekStart}_to_${this.facultyHistoryWeekEnd}`;
    }

    const trainerTag = this.facultyHistoryTrainerFilter !== "ALL" ? `_${this.facultyHistoryTrainerFilter}` : "_ALL_FACULTY";

    try {
      const blob = await this.trainerService.downloadFacultyAttendanceCsv(filters);
      if (typeof window !== "undefined" && typeof document !== "undefined") {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Faculty_Attendance_Register${trainerTag}_${filenameSuffix}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      this.showNotification("Failed to export faculty attendance CSV.", "error");
    } finally {
      this.exportingFacultyHistoryCsv = false;
      this.cdr.markForCheck();
    }
  }

  openFacultyRegister(rangeMode?: "monthly" | "weekly"): void {
    this.selectedTab = "attendance";
    this.attendanceSubView = "FACULTY_REGISTER";
    if (rangeMode) {
      this.setFacultyHistoryRangeMode(rangeMode);
    } else {
      this.loadFacultyAttendanceHistory();
    }
    this.cdr.markForCheck();
  }

  switchTab(tab: TrainerTab): void {
    this.selectedTab = tab;
    this.notificationMessage = "";
    if (tab === "overview") {
      this.loadOverview();
      this.loadFacultyDailyAttendance();
    }
    else if (tab === "trainers") this.loadTrainers();
    else if (tab === "batches") this.loadBatches();
    else if (tab === "courses") this.loadCourseAllocations();
    else if (tab === "students") this.loadStudents();
    else if (tab === "attendance") {
      this.loadStudents().then(() => this.initAttendanceGrid());
      this.loadScorecards();
      this.loadSavedAttendance();
      this.loadMonthlyRegister();
      this.loadFacultyAttendanceHistory();
    } else if (tab === "availability") {
      this.loadTrainers();
      this.loadFacultyDailyAttendance();
    }
    else if (tab === "history") this.loadHistory();
    this.cdr.markForCheck();
  }

  showNotification(message: string, type: "success" | "error" | "info" = "success"): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.notificationMessage === message) {
        this.notificationMessage = "";
        this.cdr.markForCheck();
      }
    }, 6000);
  }

  // ==========================================
  // SECTION A: OVERVIEW
  // ==========================================
  async loadOverview(): Promise<void> {
    try {
      this.overview = await this.trainerService.getOverview();
    } catch (err: any) {
      console.error("Failed to load trainer overview:", err);
    }
    this.cdr.markForCheck();
  }

  filterByOverviewCard(type: string): void {
    if (type === "trainers") {
      this.selectedTab = "trainers";
      this.trainerStatusFilter = "ALL";
      this.trainerAvailabilityFilter = "ALL";
      this.loadTrainers();
    } else if (type === "available") {
      this.selectedTab = "trainers";
      this.trainerStatusFilter = "ACTIVE";
      this.trainerAvailabilityFilter = "AVAILABLE";
      this.loadTrainers();
    } else if (type === "absent") {
      this.selectedTab = "trainers";
      this.trainerStatusFilter = "ALL";
      this.trainerAvailabilityFilter = "ABSENT";
      this.loadTrainers();
    } else if (type === "students") {
      this.selectedTab = "students";
      this.studentAllocationFilter = "ALL";
      this.loadStudents();
    } else if (type === "unassigned") {
      this.selectedTab = "students";
      this.studentAllocationFilter = "UNASSIGNED";
      this.loadStudents();
    } else if (type === "courses-unassigned") {
      this.selectedTab = "courses";
      this.loadCourseAllocations();
    }
    this.cdr.markForCheck();
  }

  // Trainer Absence Alert Actions
  getTotalAbsentAffectedStudents(): number {
    return (this.overview?.absentTrainersWithStudents || []).reduce(
      (sum, item) => sum + (item.affectedStudentCount || 0),
      0
    );
  }

  isTrainerAbsent(trainerId?: string | null): boolean {
    if (!trainerId) return false;
    return (this.overview?.absentTrainersWithStudents || []).some(
      (a) => a.trainerId === trainerId
    );
  }

  async resolveTrainerAbsence(alert?: AbsentTrainerAlert): Promise<void> {
    const targetAlert = alert || this.overview?.absentTrainersWithStudents?.[0];
    if (!targetAlert) {
      this.switchTab("trainers");
      return;
    }

    const targetTrainer =
      this.trainers.find((t) => t.id === targetAlert.trainerId || (t as any)._id === targetAlert.trainerId) ||
      this.overview?.trainerWorkloads.find((tw) => tw.id === targetAlert.trainerId || (tw as any)._id === targetAlert.trainerId);

    if (targetTrainer) {
      await this.openAvailabilityModal(targetTrainer);
    } else {
      this.switchTab("trainers");
    }
  }

  // ==========================================
  // SECTION B: TRAINER DIRECTORY
  // ==========================================
  async loadTrainers(): Promise<void> {
    try {
      this.trainers = await this.trainerService.getTrainers({
        search: this.trainerSearch,
        status: this.trainerStatusFilter,
        availability: this.trainerAvailabilityFilter,
        employmentType: this.trainerEmploymentFilter,
        course: this.trainerCourseFilter,
      });
    } catch (err: any) {
      console.error("Failed to load trainers:", err);
    }
    this.cdr.markForCheck();
  }

  async loadCourses(): Promise<void> {
    try {
      this.courseService.list().subscribe({
        next: (courses) => {
          this.activeCourses = (courses || []).filter(
            (c) => !c.status || c.status.toUpperCase() === "ACTIVE"
          );
          if (!this.activeCourses.length && this.courseAllocations.length) {
            this.activeCourses = this.courseAllocations.map((ca) => ({
              id: ca.courseId,
              name: ca.courseName,
              status: "ACTIVE",
            })) as any;
          }
          this.cdr.markForCheck();
        },
      });
    } catch (err: any) {
      console.error("Failed to load courses:", err);
    }
  }

  getEmptyTrainerForm() {
    return {
      name: "",
      email: "",
      phone: "",
      qualification: "",
      specialization: "",
      skillsString: "",
      qualifiedCourses: [] as string[],
      employmentType: "FULL_TIME" as TrainerEmploymentType,
      maxCapacity: 20,
      availability: "AVAILABLE" as TrainerAvailabilityStatus,
      status: "ACTIVE" as TrainerStatus,
      hourlyRate: 0,
      contractTerms: "",
      documentName: "",
      documentUrl: "",
      notes: "",
    };
  }

  openAddTrainerModal(): void {
    this.isEditingTrainer = false;
    this.trainerFormId = "";
    this.trainerForm = this.getEmptyTrainerForm();
    this.trainerFormError = "";
    this.showTrainerModal = true;
    this.cdr.markForCheck();
  }

  openEditTrainerModal(trainer: Trainer): void {
    this.isEditingTrainer = true;
    this.trainerFormId = trainer.id;
    this.trainerForm = {
      name: trainer.name || "",
      email: trainer.email || "",
      phone: trainer.phone || "",
      qualification: trainer.qualification || "",
      specialization: trainer.specialization || "",
      skillsString: (trainer.skills || []).join(", "),
      qualifiedCourses: [...(trainer.qualifiedCourses || [])],
      employmentType: trainer.employmentType || "FULL_TIME",
      maxCapacity: trainer.maxCapacity || 20,
      availability: trainer.availability || "AVAILABLE",
      status: trainer.status || "ACTIVE",
      hourlyRate: trainer.hourlyRate || 0,
      contractTerms: trainer.contractTerms || "",
      documentName: (trainer.documents && trainer.documents[0]?.name) || "",
      documentUrl: (trainer.documents && trainer.documents[0]?.url) || "",
      notes: trainer.notes || "",
    };
    this.trainerFormError = "";
    this.showTrainerModal = true;
    this.cdr.markForCheck();
  }

  closeTrainerModal(): void {
    this.showTrainerModal = false;
    this.trainerFormError = "";
    this.cdr.markForCheck();
  }

  toggleQualifiedCourse(courseName: string): void {
    const idx = this.trainerForm.qualifiedCourses.indexOf(courseName);
    if (idx > -1) {
      this.trainerForm.qualifiedCourses.splice(idx, 1);
    } else {
      this.trainerForm.qualifiedCourses.push(courseName);
    }
  }

  async saveTrainer(): Promise<void> {
    if (!this.trainerForm.name.trim()) {
      this.trainerFormError = "Trainer name is required.";
      return;
    }
    if (!this.trainerForm.email.trim()) {
      this.trainerFormError = "Valid trainer email is required.";
      return;
    }

    this.trainerFormSaving = true;
    this.trainerFormError = "";
    this.cdr.markForCheck();

    const skills = this.trainerForm.skillsString
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const documents = this.trainerForm.documentName.trim()
      ? [{ name: this.trainerForm.documentName.trim(), url: this.trainerForm.documentUrl.trim(), uploadedAt: new Date() }]
      : [];

    try {
      if (this.isEditingTrainer) {
        await this.trainerService.updateTrainer(this.trainerFormId, {
          name: this.trainerForm.name,
          email: this.trainerForm.email,
          phone: this.trainerForm.phone,
          qualification: this.trainerForm.qualification,
          specialization: this.trainerForm.specialization,
          skills,
          qualifiedCourses: this.trainerForm.qualifiedCourses,
          employmentType: this.trainerForm.employmentType,
          maxCapacity: this.trainerForm.maxCapacity,
          availability: this.trainerForm.availability,
          status: this.trainerForm.status,
          hourlyRate: this.trainerForm.hourlyRate,
          contractTerms: this.trainerForm.contractTerms,
          documents,
          notes: this.trainerForm.notes,
        });
        this.showNotification(`Trainer '${this.trainerForm.name}' updated successfully.`);
      } else {
        const created = await this.trainerService.createTrainer({
          name: this.trainerForm.name,
          email: this.trainerForm.email,
          phone: this.trainerForm.phone,
          qualification: this.trainerForm.qualification,
          specialization: this.trainerForm.specialization,
          skills,
          qualifiedCourses: this.trainerForm.qualifiedCourses,
          employmentType: this.trainerForm.employmentType,
          maxCapacity: this.trainerForm.maxCapacity,
          availability: this.trainerForm.availability,
          status: this.trainerForm.status,
          hourlyRate: this.trainerForm.hourlyRate,
          contractTerms: this.trainerForm.contractTerms,
          documents,
          notes: this.trainerForm.notes,
        });
        this.showNotification(`Trainer registered successfully with ID ${created.id}.`);
      }
      this.closeTrainerModal();
      await this.loadTrainers();
      await this.loadOverview();
    } catch (err: any) {
      this.trainerFormError = err?.error?.message || err?.message || "Failed to save trainer details.";
    } finally {
      this.trainerFormSaving = false;
      this.cdr.markForCheck();
    }
  }

  async toggleTrainerStatus(trainer: Trainer): Promise<void> {
    const newStatus: TrainerStatus = trainer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMsg =
      newStatus === "INACTIVE"
        ? `Are you sure you want to deactivate trainer '${trainer.name}'?`
        : `Activate trainer '${trainer.name}'?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await this.trainerService.toggleTrainerStatus(trainer.id, newStatus);
      trainer.status = newStatus;
      this.showNotification(`Trainer '${trainer.name}' status set to ${newStatus}.`);
      await this.loadOverview();
    } catch (err: any) {
      this.showNotification(err?.error?.message || "Failed to toggle trainer status.", "error");
    }
    this.cdr.markForCheck();
  }

  async viewTrainerProfile(trainer: Trainer): Promise<void> {
    this.selectedTrainerProfile = trainer;
    this.showProfileModal = true;
    this.loadingProfile = true;
    this.profileAssignedStudents = [];
    this.profileAssignedCourses = [];
    this.cdr.markForCheck();

    try {
      const details = await this.trainerService.getTrainerById(trainer.id);
      this.selectedTrainerProfile = details.trainer;
      this.profileAssignedStudents = details.assignedStudents || [];
      this.profileAssignedCourses = details.assignedCoursesDetails || [];
    } catch (err: any) {
      console.error("Failed to load trainer profile:", err);
    } finally {
      this.loadingProfile = false;
      this.cdr.markForCheck();
    }
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.selectedTrainerProfile = null;
    this.cdr.markForCheck();
  }

  async resetPasswordForTrainer(trainer: Trainer): Promise<void> {
    const confirmReset = window.confirm(`Reset portal login password for trainer '${trainer.name}' (${trainer.id})?`);
    if (!confirmReset) return;

    try {
      const res = await this.trainerService.resetTrainerPassword(trainer.id);
      trainer.accountPassword = res.defaultPassword;
      if (this.selectedTrainerProfile?.id === trainer.id) {
        this.selectedTrainerProfile.accountPassword = res.defaultPassword;
      }
      this.showNotification(`Password reset for ${trainer.name}. New default password: ${res.defaultPassword}`);
      this.cdr.markForCheck();
    } catch (err: any) {
      this.showNotification(err?.error?.message || "Failed to reset password.", "error");
    }
  }

  // ==========================================
  // SECTION: TRAINER ROSTER & STUDENT 360 MODALS (PHASE 1)
  viewTrainerDetail(trainerId: string): void {
    const trainer = this.trainers.find((t) => t.id === trainerId || (t as any)._id === trainerId);
    if (trainer) {
      this.openTrainerRoster(trainer);
    }
  }

  // ==========================================
  async openTrainerRoster(trainer: Trainer): Promise<void> {
    this.selectedRosterTrainer = trainer;
    this.showTrainerRosterModal = true;
    this.loadingRoster = true;
    this.rosterStudents = [];
    this.cdr.markForCheck();

    try {
      if (!this.students || !this.students.length) {
        await this.loadStudents();
      }
      const trainerId = trainer.id || (trainer as any)._id;
      this.rosterStudents = this.students.filter(
        (s) => s.trainerId === trainerId || (s as any).trainer?._id === trainerId
      );
    } catch (err: any) {
      console.error("Failed to load trainer roster:", err);
    } finally {
      this.loadingRoster = false;
      this.cdr.markForCheck();
    }
  }

  closeTrainerRoster(): void {
    this.showTrainerRosterModal = false;
    this.selectedRosterTrainer = null;
    this.rosterStudents = [];
    this.cdr.markForCheck();
  }

  jumpToTrainerAttendance(trainer: Trainer): void {
    const trainerId = trainer.id || (trainer as any)._id;
    this.closeTrainerRoster();
    this.selectedTab = "attendance";
    this.attendanceTrainerFilter = trainerId;
    this.attendanceCourseFilter = "ALL";
    this.initAttendanceGrid();
    this.loadSavedAttendance();
    this.cdr.markForCheck();
  }

  async viewStudentDetail(studentId: string): Promise<void> {
    this.showStudentDetailModal = true;
    this.loadingStudentDetail = true;
    this.studentDetailSummary = null;
    this.studentDetailError = "";
    this.cdr.markForCheck();

    try {
      this.studentDetailSummary = await this.trainerService.getStudentTrainingSummary(studentId);
    } catch (err: any) {
      this.studentDetailError = err?.error?.message || err?.message || "Failed to load student details.";
    } finally {
      this.loadingStudentDetail = false;
      this.cdr.markForCheck();
    }
  }

  closeStudentDetail(): void {
    this.showStudentDetailModal = false;
    this.studentDetailSummary = null;
    this.studentDetailError = "";
    this.cdr.markForCheck();
  }

  // ==========================================
  // SECTION: BATCH & SCHEDULE MANAGEMENT
  // ==========================================
  getEmptyBatchForm() {
    const defaultTrainer = (this.trainers || []).find((t) => t.status === "ACTIVE") || (this.trainers || [])[0];
    const defaultCourse = this.activeCourses?.[0]?.name || this.courseAllocations?.[0]?.courseName || "";
    return {
      batchName: "",
      courseName: defaultCourse,
      trainerId: defaultTrainer?.id || (defaultTrainer as any)?._id || "",
      timeSlot: "10:00 AM - 12:00 PM",
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      meetingLink: "",
      classroomLocation: "Online Interactive",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      totalSessions: 15,
      status: "ACTIVE" as "UPCOMING" | "ACTIVE" | "COMPLETED",
      notes: "",
    };
  }

  get filteredBatches(): TrainerBatch[] {
    if (!this.batchSearch || !this.batchSearch.trim()) return this.batches;
    const term = this.batchSearch.toLowerCase().trim();
    return this.batches.filter(
      (b) =>
        (b.batchName && b.batchName.toLowerCase().includes(term)) ||
        (b.courseName && b.courseName.toLowerCase().includes(term)) ||
        (b.trainerName && b.trainerName.toLowerCase().includes(term)) ||
        (b.timeSlot && b.timeSlot.toLowerCase().includes(term))
    );
  }

  async loadBatches(): Promise<void> {
    try {
      this.batches = await this.trainerService.getBatches({
        status: this.batchStatusFilter,
      });
      await this.loadInstitutionalHolidays();
    } catch (err: any) {
      console.error("Failed to load batches:", err);
    }
    this.cdr.markForCheck();
  }

  openAddBatchModal(): void {
    this.isEditingBatch = false;
    this.batchFormId = "";
    this.batchForm = this.getEmptyBatchForm();
    this.batchFormError = "";
    this.batchScheduleCalc = null;
    this.showBatchModal = true;
    this.autoCalculateBatchEndDate();
    this.cdr.markForCheck();
  }

  openEditBatchModal(batch: TrainerBatch): void {
    this.isEditingBatch = true;
    this.batchFormId = batch.id || (batch as any)._id;
    this.batchForm = {
      batchName: batch.batchName,
      courseName: batch.courseName,
      trainerId: batch.trainerId,
      timeSlot: batch.timeSlot,
      days: [...(batch.days || ["Mon", "Tue", "Wed", "Thu", "Fri"])],
      meetingLink: batch.meetingLink || "",
      classroomLocation: batch.classroomLocation || "Online Interactive",
      startDate: batch.startDate ? new Date(batch.startDate).toISOString().slice(0, 10) : "",
      endDate: batch.endDate ? new Date(batch.endDate).toISOString().slice(0, 10) : "",
      totalSessions: batch.totalSessions || 15,
      status: batch.status,
      notes: batch.notes || "",
    };
    this.batchFormError = "";
    this.batchScheduleCalc = null;
    this.showBatchModal = true;
    this.cdr.markForCheck();
  }

  closeBatchModal(): void {
    this.showBatchModal = false;
    this.batchFormError = "";
    this.batchScheduleCalc = null;
    this.cdr.markForCheck();
  }

  toggleBatchDay(day: string): void {
    const idx = this.batchForm.days.indexOf(day);
    if (idx > -1) {
      this.batchForm.days.splice(idx, 1);
    } else {
      this.batchForm.days.push(day);
    }
    this.autoCalculateBatchEndDate();
  }

  onBatchScheduleInputsChange(): void {
    if (this.batchForm.startDate && this.batchForm.totalSessions && this.batchForm.totalSessions > 0) {
      this.autoCalculateBatchEndDate();
    }
  }

  async autoCalculateBatchEndDate(): Promise<void> {
    if (!this.batchForm.startDate || !this.batchForm.totalSessions || this.batchForm.totalSessions < 1) {
      return;
    }
    this.calculatingBatchSchedule = true;
    this.cdr.markForCheck();
    try {
      const result = await this.trainerService.calculateBatchSchedule({
        startDate: this.batchForm.startDate,
        totalSessions: Number(this.batchForm.totalSessions),
        days: this.batchForm.days,
      });
      if (result) {
        this.batchScheduleCalc = result;
        this.batchForm.endDate = result.endDate;
      }
    } catch (err) {
      console.warn("Could not auto-calculate batch schedule:", err);
    } finally {
      this.calculatingBatchSchedule = false;
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // INSTITUTIONAL HOLIDAYS MODAL & MANAGEMENT
  // ==========================================
  async loadInstitutionalHolidays(): Promise<void> {
    this.loadingHolidays = true;
    this.cdr.markForCheck();
    try {
      this.institutionalHolidays = await this.trainerService.getHolidays();
    } catch (err) {
      console.error("Failed to load institutional holidays:", err);
    } finally {
      this.loadingHolidays = false;
      this.cdr.markForCheck();
    }
  }

  openHolidaysModal(): void {
    this.showHolidaysModal = true;
    this.holidayError = "";
    this.holidayForm = {
      date: new Date().toISOString().slice(0, 10),
      name: "",
      type: "GOVERNMENT",
      description: "",
    };
    this.loadInstitutionalHolidays();
  }

  closeHolidaysModal(): void {
    this.showHolidaysModal = false;
    this.holidayError = "";
    this.cdr.markForCheck();
  }

  async saveInstitutionalHoliday(): Promise<void> {
    if (!this.holidayForm.date) {
      this.holidayError = "Holiday date is required.";
      return;
    }
    if (!this.holidayForm.name.trim()) {
      this.holidayError = "Holiday name is required.";
      return;
    }

    this.savingHoliday = true;
    this.holidayError = "";
    this.cdr.markForCheck();
    try {
      await this.trainerService.createHoliday(this.holidayForm);
      this.showNotification(`Holiday '${this.holidayForm.name}' saved successfully.`, "success");
      this.holidayForm = {
        date: new Date().toISOString().slice(0, 10),
        name: "",
        type: "GOVERNMENT",
        description: "",
      };
      await this.loadInstitutionalHolidays();
      if (this.showBatchModal) {
        await this.autoCalculateBatchEndDate();
      }
    } catch (err: any) {
      this.holidayError = err?.error?.message || err?.message || "Failed to save holiday.";
    } finally {
      this.savingHoliday = false;
      this.cdr.markForCheck();
    }
  }

  async deleteInstitutionalHoliday(id: string): Promise<void> {
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm("Are you sure you want to remove this institutional holiday?")) {
      return;
    }
    try {
      await this.trainerService.deleteHoliday(id);
      this.showNotification("Holiday removed successfully.", "info");
      await this.loadInstitutionalHolidays();
      if (this.showBatchModal) {
        await this.autoCalculateBatchEndDate();
      }
    } catch (err: any) {
      this.showNotification(err?.error?.message || "Failed to delete holiday.", "error");
    }
    this.cdr.markForCheck();
  }

  async saveBatch(): Promise<void> {
    if (!this.batchForm.batchName.trim()) {
      this.batchFormError = "Batch Name is required.";
      return;
    }
    if (!this.batchForm.courseName.trim()) {
      this.batchFormError = "Course is required.";
      return;
    }
    if (!this.batchForm.trainerId) {
      this.batchFormError = "Trainer assignment is required.";
      return;
    }

    this.batchFormSaving = true;
    this.batchFormError = "";
    this.cdr.markForCheck();

    try {
      if (this.isEditingBatch) {
        await this.trainerService.updateBatch(this.batchFormId, this.batchForm);
        this.showNotification(`Batch '${this.batchForm.batchName}' updated successfully.`);
      } else {
        await this.trainerService.createBatch(this.batchForm);
        this.showNotification(`New batch '${this.batchForm.batchName}' created successfully.`);
      }
      this.closeBatchModal();
      await this.loadBatches();
    } catch (err: any) {
      this.batchFormError = err?.error?.message || err?.message || "Failed to save batch.";
    } finally {
      this.batchFormSaving = false;
      this.cdr.markForCheck();
    }
  }

  async deleteBatch(batch: TrainerBatch): Promise<void> {
    const batchId = batch.id || (batch as any)._id;
    if (!window.confirm(`Delete batch '${batch.batchName}'?`)) return;
    try {
      await this.trainerService.deleteBatch(batchId);
      this.showNotification(`Batch '${batch.batchName}' deleted.`);
      await this.loadBatches();
    } catch (err: any) {
      this.showNotification(err?.error?.message || "Failed to delete batch.", "error");
    }
    this.cdr.markForCheck();
  }

  // ==========================================
  // SECTION C: COURSE ALLOCATION
  // ==========================================
  async loadCourseAllocations(): Promise<void> {
    try {
      this.courseAllocations = await this.trainerService.getCourseAllocations();
    } catch (err: any) {
      console.error("Failed to load course allocations:", err);
    }
    this.cdr.markForCheck();
  }

  openCourseAllocationModal(item: CourseAllocationItem): void {
    this.selectedCourseForAllocation = item;
    this.courseAllocationForm = {
      primaryTrainerId: item.primaryTrainer?.id || "",
      backupTrainerIds: (item.backupTrainers || []).map((bt) => bt.id),
      notes: "",
    };
    this.courseAllocationError = "";
    this.showCourseAllocationModal = true;
    this.cdr.markForCheck();
  }

  closeCourseAllocationModal(): void {
    this.showCourseAllocationModal = false;
    this.selectedCourseForAllocation = null;
    this.courseAllocationError = "";
    this.cdr.markForCheck();
  }

  toggleBackupTrainer(trainerId: string): void {
    const idx = this.courseAllocationForm.backupTrainerIds.indexOf(trainerId);
    if (idx > -1) {
      this.courseAllocationForm.backupTrainerIds.splice(idx, 1);
    } else {
      this.courseAllocationForm.backupTrainerIds.push(trainerId);
    }
  }

  async saveCourseAllocation(): Promise<void> {
    if (!this.selectedCourseForAllocation) return;

    this.courseAllocationSaving = true;
    this.courseAllocationError = "";
    this.cdr.markForCheck();

    try {
      await this.trainerService.setCourseAllocation(this.selectedCourseForAllocation.courseId, {
        primaryTrainerId: this.courseAllocationForm.primaryTrainerId || null,
        backupTrainerIds: this.courseAllocationForm.backupTrainerIds,
        notes: this.courseAllocationForm.notes,
      });

      this.showNotification(`Allocations updated for '${this.selectedCourseForAllocation.courseName}'.`);
      this.closeCourseAllocationModal();
      await this.loadCourseAllocations();
      await this.loadOverview();
    } catch (err: any) {
      this.courseAllocationError = err?.error?.message || err?.message || "Failed to update course allocation.";
    } finally {
      this.courseAllocationSaving = false;
      this.cdr.markForCheck();
    }
  }

  async removeCourseAllocation(item: CourseAllocationItem): Promise<void> {
    if (!window.confirm(`Remove all trainer allocations for '${item.courseName}'?`)) return;

    try {
      await this.trainerService.removeCourseAllocation(item.courseId);
      this.showNotification(`Allocations removed for '${item.courseName}'.`);
      await this.loadCourseAllocations();
      await this.loadOverview();
    } catch (err: any) {
      this.showNotification(err?.error?.message || "Failed to remove allocation.", "error");
    }
    this.cdr.markForCheck();
  }

  // ==========================================
  // SECTION D: STUDENT ALLOCATION
  // ==========================================
  async loadStudents(): Promise<void> {
    try {
      this.students = await this.trainerService.getEligibleStudents({
        search: this.studentSearch,
        course: this.studentCourseFilter,
        trainerId: this.studentTrainerFilter,
        allocationStatus: this.studentAllocationFilter,
      });
      this.selectedStudentIds.clear();
    } catch (err: any) {
      console.error("Failed to load students:", err);
    }
    this.cdr.markForCheck();
  }

  toggleSelectAllStudents(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      for (const s of this.students) {
        this.selectedStudentIds.add(s.id);
      }
    } else {
      this.selectedStudentIds.clear();
    }
    this.cdr.markForCheck();
  }

  toggleStudentSelection(studentId: string): void {
    if (this.selectedStudentIds.has(studentId)) {
      this.selectedStudentIds.delete(studentId);
    } else {
      this.selectedStudentIds.add(studentId);
    }
    this.cdr.markForCheck();
  }

  get allStudentsSelected(): boolean {
    return this.students.length > 0 && this.students.every((s) => this.selectedStudentIds.has(s.id));
  }

  get selectedStudentsList(): EligibleStudent[] {
    return this.students.filter((s) => this.selectedStudentIds.has(s.id));
  }

  openSingleAllocateModal(student: EligibleStudent): void {
    this.targetStudentForAllocation = student;
    this.singleAllocateTargetTrainerId = student.trainerId || "";
    this.singleAllocateReason = "";
    this.singleAllocateError = "";
    this.showSingleAllocateModal = true;
    this.cdr.markForCheck();
  }

  closeSingleAllocateModal(): void {
    this.showSingleAllocateModal = false;
    this.targetStudentForAllocation = null;
    this.singleAllocateError = "";
    this.cdr.markForCheck();
  }

  getQualifiedTrainersForStudent(student: EligibleStudent | null): Trainer[] {
    if (!student) return this.trainers.filter((t) => t.status === "ACTIVE" && t.availability === "AVAILABLE");
    const normCourse = student.enrolledCourse.toLowerCase();
    return this.trainers.filter((t) => {
      if (t.status !== "ACTIVE" || t.availability !== "AVAILABLE") return false;
      const hasQual = (t.qualifiedCourses || []).some((qc) => qc.toLowerCase() === normCourse || normCourse.includes(qc.toLowerCase()));
      const hasAssigned = (t.assignedCourses || []).some((ac) => ac.toLowerCase() === normCourse || normCourse.includes(ac.toLowerCase()));
      const hasSpec = t.specialization?.toLowerCase().includes(normCourse);
      return hasQual || hasAssigned || hasSpec;
    });
  }

  async saveSingleStudentAllocation(): Promise<void> {
    if (!this.targetStudentForAllocation) return;
    if (!this.singleAllocateTargetTrainerId) {
      this.singleAllocateError = "Please select a target trainer.";
      return;
    }

    this.singleAllocateSaving = true;
    this.singleAllocateError = "";
    this.cdr.markForCheck();

    try {
      await this.trainerService.allocateStudent(
        this.targetStudentForAllocation.id,
        this.singleAllocateTargetTrainerId,
        this.singleAllocateReason
      );

      this.showNotification(`Student '${this.targetStudentForAllocation.name}' successfully allocated.`);
      this.closeSingleAllocateModal();
      await this.loadStudents();
      await this.loadTrainers();
      await this.loadOverview();
    } catch (err: any) {
      this.singleAllocateError = err?.error?.message || err?.message || "Failed to allocate student.";
    } finally {
      this.singleAllocateSaving = false;
      this.cdr.markForCheck();
    }
  }

  openBulkAllocateModal(): void {
    if (this.selectedStudentIds.size === 0) return;
    this.bulkAllocateTargetTrainerId = "";
    this.bulkAllocateReason = "";
    this.bulkAllocateError = "";
    this.showBulkAllocateModal = true;
    this.cdr.markForCheck();
  }

  closeBulkAllocateModal(): void {
    this.showBulkAllocateModal = false;
    this.bulkAllocateError = "";
    this.cdr.markForCheck();
  }

  async saveBulkAllocation(): Promise<void> {
    if (!this.bulkAllocateTargetTrainerId) {
      this.bulkAllocateError = "Please select a target trainer.";
      return;
    }

    const ids = Array.from(this.selectedStudentIds);
    this.bulkAllocateSaving = true;
    this.bulkAllocateError = "";
    this.cdr.markForCheck();

    try {
      const res = await this.trainerService.allocateBulkStudents(
        ids,
        this.bulkAllocateTargetTrainerId,
        this.bulkAllocateReason
      );

      this.showNotification(`Successfully allocated ${res.allocatedCount} students.`);
      this.closeBulkAllocateModal();
      await this.loadStudents();
      await this.loadTrainers();
      await this.loadOverview();
    } catch (err: any) {
      this.bulkAllocateError = err?.error?.message || err?.message || "Failed to complete bulk allocation.";
    } finally {
      this.bulkAllocateSaving = false;
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // SECTION: ATTENDANCE & PERFORMANCE
  // ==========================================
  initAttendanceGrid(): void {
    let assignedStudents = this.students.filter((s) => s.trainerId);
    if (this.attendanceCourseFilter && this.attendanceCourseFilter !== "ALL") {
      assignedStudents = assignedStudents.filter(
        (s) => (s.enrolledCourse || "").toLowerCase() === this.attendanceCourseFilter.toLowerCase()
      );
    }
    if (this.attendanceTrainerFilter && this.attendanceTrainerFilter !== "ALL") {
      assignedStudents = assignedStudents.filter(
        (s) => s.trainerId === this.attendanceTrainerFilter
      );
    }
    this.attendanceItems = assignedStudents.map((s) => ({
      studentId: s.id,
      studentName: s.name,
      courseName: s.enrolledCourse,
      trainerId: s.trainerId || "",
      trainerName: s.trainerName || "Trainer",
      status: "PRESENT",
      topicCovered: this.topicCoveredToday,
      remarks: "",
    }));
    this.cdr.markForCheck();
  }

  markAllAttendanceStatus(status: "PRESENT" | "ABSENT" | "LATE"): void {
    for (const item of this.attendanceItems) {
      item.status = status;
    }
    this.cdr.markForCheck();
  }

  setStudentAttendanceStatus(item: any, status: "PRESENT" | "ABSENT" | "LATE"): void {
    item.status = status;
    this.cdr.markForCheck();
  }

  async saveAttendanceBatch(): Promise<void> {
    if (!this.attendanceItems.length) return;
    this.attendanceSaving = true;
    this.cdr.markForCheck();

    const payload = this.attendanceItems.map((item) => ({
      ...item,
      date: this.attendanceDate,
      topicCovered: this.topicCoveredToday || item.topicCovered,
    }));

    try {
      await this.trainerService.markAttendance(payload);
      this.showNotification(`Attendance saved for ${payload.length} students on ${this.attendanceDate}.`);
      await this.loadSavedAttendance();
      await this.loadMonthlyRegister();
    } catch (err: any) {
      this.showNotification(err?.error?.message || "Failed to save attendance.", "error");
    } finally {
      this.attendanceSaving = false;
      this.cdr.markForCheck();
    }
  }

  // Saved Attendance Register & Audit Log
  async loadSavedAttendance(): Promise<void> {
    this.loadingSavedAttendance = true;
    this.cdr.markForCheck();
    try {
      this.savedAttendanceRecords = await this.trainerService.getAttendance({
        date: this.savedAttendanceDateFilter || undefined,
        trainerId: this.savedAttendanceTrainerFilter !== "ALL" ? this.savedAttendanceTrainerFilter : undefined,
        courseName: this.savedAttendanceCourseFilter !== "ALL" ? this.savedAttendanceCourseFilter : undefined,
      });
    } catch (err: any) {
      console.error("Failed to load saved attendance records:", err);
    } finally {
      this.loadingSavedAttendance = false;
      this.cdr.markForCheck();
    }
  }

  get filteredSavedAttendance(): TrainerAttendance[] {
    if (!this.savedAttendanceSearch || !this.savedAttendanceSearch.trim()) {
      return this.savedAttendanceRecords;
    }
    const term = this.savedAttendanceSearch.toLowerCase().trim();
    return this.savedAttendanceRecords.filter(
      (r) =>
        (r.studentName && r.studentName.toLowerCase().includes(term)) ||
        (r.studentId && r.studentId.toLowerCase().includes(term)) ||
        (r.trainerName && r.trainerName.toLowerCase().includes(term)) ||
        (r.courseName && r.courseName.toLowerCase().includes(term)) ||
        (r.topicCovered && r.topicCovered.toLowerCase().includes(term))
    );
  }

  get savedAttendanceSummary(): { total: number; present: number; late: number; absent: number; percent: number } {
    const records = this.filteredSavedAttendance;
    const total = records.length;
    const present = records.filter((r) => r.status === "PRESENT").length;
    const late = records.filter((r) => r.status === "LATE").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    const percent = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    return { total, present, late, absent, percent };
  }

  // ==========================================
  // MONTHLY ATTENDANCE REGISTER MATRIX & DATE ARCHIVE
  // ==========================================
  setAttendanceSubView(view: "DAILY_LOGGER" | "MONTHLY_REGISTER" | "DATE_ARCHIVE" | "FACULTY_REGISTER"): void {
    this.attendanceSubView = view;
    if (view === "MONTHLY_REGISTER") {
      this.loadMonthlyRegister();
    } else if (view === "DATE_ARCHIVE") {
      this.loadDateArchive();
    } else if (view === "FACULTY_REGISTER") {
      this.loadFacultyAttendanceHistory();
    }
    this.cdr.markForCheck();
  }

  updateDaysInMonth(): void {
    if (!this.selectedRegisterMonth) {
      this.selectedRegisterMonth = new Date().toISOString().slice(0, 7);
    }
    const [yearStr, monthStr] = this.selectedRegisterMonth.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    const totalDays = new Date(year, month, 0).getDate();
    this.daysInSelectedMonth = Array.from({ length: totalDays }, (_, i) => i + 1);
  }

  async loadMonthlyRegister(): Promise<void> {
    this.loadingMonthlyRegister = true;
    this.updateDaysInMonth();
    this.cdr.markForCheck();

    try {
      if (!this.students || !this.students.length) {
        await this.loadStudents();
      }

      this.monthlyAttendanceRecords = await this.trainerService.getAttendance({
        month: this.selectedRegisterMonth,
        trainerId: this.registerTrainerFilter !== "ALL" ? this.registerTrainerFilter : undefined,
        courseName: this.registerCourseFilter !== "ALL" ? this.registerCourseFilter : undefined,
      });

      this.buildMonthlyRegisterMatrix();
      if (this.facultyHistoryRangeMode === "monthly") {
        this.facultyHistoryMonth = this.selectedRegisterMonth;
      }
      await this.loadFacultyAttendanceHistory();
    } catch (err: any) {
      console.error("Failed to load monthly attendance register:", err);
    } finally {
      this.loadingMonthlyRegister = false;
      this.cdr.markForCheck();
    }
  }

  buildMonthlyRegisterMatrix(): void {
    const studentRecordsMap = new Map<string, TrainerAttendance[]>();
    for (const record of this.monthlyAttendanceRecords) {
      const list = studentRecordsMap.get(record.studentId) || [];
      list.push(record);
      studentRecordsMap.set(record.studentId, list);
    }

    const assignedStudents = this.students.filter((s) => s.trainerId);

    this.monthlyRegisterRows = assignedStudents.map((s) => {
      const records = studentRecordsMap.get(s.id) || [];
      const dayStatuses: Record<number, { status: "PRESENT" | "ABSENT" | "LATE"; topic?: string; remarks?: string; date: string }> = {};

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;

      for (const rec of records) {
        if (!rec.date) continue;
        const dayNum = parseInt(rec.date.slice(8, 10), 10);
        if (!isNaN(dayNum)) {
          dayStatuses[dayNum] = {
            status: rec.status,
            topic: rec.topicCovered || "",
            remarks: rec.remarks || "",
            date: rec.date,
          };
          if (rec.status === "PRESENT") presentCount++;
          else if (rec.status === "LATE") lateCount++;
          else if (rec.status === "ABSENT") absentCount++;
        }
      }

      const totalHeld = records.length;
      const convertedLeaveDays = Math.floor(lateCount / 3);
      const activeStrikes = lateCount % 3;
      const effectivePresent = Math.max(0, presentCount + lateCount - convertedLeaveDays);
      const attendancePercent = totalHeld > 0 ? Math.round((effectivePresent / totalHeld) * 100) : 100;

      let consecutiveAbsents = 0;
      let maxConsecutive = 0;
      const sortedDays = Object.keys(dayStatuses).map(Number).sort((a, b) => a - b);
      for (const day of sortedDays) {
        if (dayStatuses[day]?.status === "ABSENT") {
          consecutiveAbsents++;
          if (consecutiveAbsents > maxConsecutive) maxConsecutive = consecutiveAbsents;
        } else {
          consecutiveAbsents = 0;
        }
      }

      const isAtRisk = totalHeld >= 3 && attendancePercent < 75;

      return {
        studentId: s.id,
        studentName: s.name,
        enrolledCourse: s.enrolledCourse,
        trainerId: s.trainerId || "",
        trainerName: s.trainerName || "Trainer",
        dayStatuses,
        totalHeld,
        presentCount,
        lateCount,
        absentCount,
        convertedLeaveDays,
        activeStrikes,
        attendancePercent,
        consecutiveAbsents: maxConsecutive,
        isAtRisk,
      };
    });
  }

  get filteredMonthlyRegisterRows(): MonthlyStudentAttendanceRow[] {
    return this.monthlyRegisterRows.filter((row) => {
      if (this.registerCourseFilter !== "ALL" && (row.enrolledCourse || "").toLowerCase() !== this.registerCourseFilter.toLowerCase()) {
        return false;
      }
      if (this.registerTrainerFilter !== "ALL" && row.trainerId !== this.registerTrainerFilter) {
        return false;
      }
      if (this.registerRiskFilter === "AT_RISK" && !row.isAtRisk) {
        return false;
      }
      if (this.registerRiskFilter === "CONSECUTIVE_ABSENT" && row.consecutiveAbsents < 3) {
        return false;
      }
      return true;
    });
  }

  get monthlyRegisterSummary(): { totalStudents: number; atRiskCount: number; consecutiveAbsentCount: number; avgAttendancePercent: number } {
    const rows = this.filteredMonthlyRegisterRows;
    const totalStudents = rows.length;
    const atRiskCount = rows.filter((r) => r.isAtRisk).length;
    const consecutiveAbsentCount = rows.filter((r) => r.consecutiveAbsents >= 3).length;

    let totalClassesSum = 0;
    let totalPresentSum = 0;
    for (const r of rows) {
      totalClassesSum += r.totalHeld;
      totalPresentSum += (r.presentCount + r.lateCount);
    }
    const avgAttendancePercent = totalClassesSum > 0 ? Math.round((totalPresentSum / totalClassesSum) * 100) : 100;

    return {
      totalStudents,
      atRiskCount,
      consecutiveAbsentCount,
      avgAttendancePercent,
    };
  }

  exportMonthlyRegisterCsv(): void {
    const rows = this.filteredMonthlyRegisterRows;
    const days = this.daysInSelectedMonth;

    const headers = [
      "Student ID",
      "Student Name",
      "Enrolled Course",
      "Assigned Trainer",
      ...days.map((d) => `Day ${d}`),
      "Total Classes Held",
      "Present",
      "Late",
      "Absent",
      "Attendance %",
      "Risk Status",
    ];

    const csvLines = [headers.join(",")];

    for (const r of rows) {
      const dayValues = days.map((d) => {
        const item = r.dayStatuses[d];
        return item ? item.status : "-";
      });

      const line = [
        `"${r.studentId}"`,
        `"${(r.studentName || "").replace(/"/g, '""')}"`,
        `"${(r.enrolledCourse || "").replace(/"/g, '""')}"`,
        `"${(r.trainerName || "").replace(/"/g, '""')}"`,
        ...dayValues,
        r.totalHeld,
        r.presentCount,
        r.lateCount,
        r.absentCount,
        `"${r.attendancePercent}%"`,
        `"${r.isAtRisk ? "AT RISK (<75%)" : "GOOD"}"`,
      ];
      csvLines.push(line.join(","));
    }

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    this.triggerDownload(blob, `TVK-Attendance-Register-${this.selectedRegisterMonth}.csv`);
    this.showNotification(`Exported monthly attendance register for ${this.selectedRegisterMonth}.`);
  }

  jumpToDailyLoggerForDate(dateStr: string): void {
    this.attendanceDate = dateStr;
    this.attendanceSubView = "DAILY_LOGGER";
    this.initAttendanceGrid();
    this.cdr.markForCheck();
  }

  jumpToDateArchiveFromMatrix(dayNum: number): void {
    const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
    this.selectedArchiveDate = `${this.selectedRegisterMonth}-${dayStr}`;
    this.attendanceSubView = "DATE_ARCHIVE";
    this.loadDateArchive();
  }

  async loadDateArchive(): Promise<void> {
    this.loadingDateArchive = true;
    this.cdr.markForCheck();
    try {
      this.archiveRecords = await this.trainerService.getAttendance({
        date: this.selectedArchiveDate,
      });
    } catch (err: any) {
      console.error("Failed to load date archive:", err);
    } finally {
      this.loadingDateArchive = false;
      this.cdr.markForCheck();
    }
  }

  get dateArchiveSummary(): {
    total: number;
    present: number;
    late: number;
    absent: number;
    percent: number;
    topics: string[];
    trainers: string[];
  } {
    const records = this.archiveRecords;
    const total = records.length;
    const present = records.filter((r) => r.status === "PRESENT").length;
    const late = records.filter((r) => r.status === "LATE").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    const percent = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    const topics = Array.from(new Set(records.map((r) => r.topicCovered || "").filter(Boolean)));
    const trainers = Array.from(new Set(records.map((r) => r.trainerName || "").filter(Boolean)));
    return { total, present, late, absent, percent, topics, trainers };
  }

  // Student Scorecard / Mock Interview Rating
  async loadScorecards(): Promise<void> {
    try {
      this.scorecards = await this.trainerService.getStudentScorecards();
    } catch (err: any) {
      console.error("Failed to load scorecards:", err);
    }
    this.cdr.markForCheck();
  }

  openScorecardModal(student: EligibleStudent): void {
    this.scorecardTargetStudent = student;
    this.scorecardForm = {
      technicalScore: 8,
      problemSolvingScore: 8,
      communicationScore: 8,
      readinessStatus: "READY",
      feedback: "",
      recommendedRole: "",
    };
    this.scorecardError = "";
    this.showScorecardModal = true;
    this.cdr.markForCheck();
  }

  closeScorecardModal(): void {
    this.showScorecardModal = false;
    this.scorecardTargetStudent = null;
    this.scorecardError = "";
    this.cdr.markForCheck();
  }

  async saveScorecard(): Promise<void> {
    if (!this.scorecardTargetStudent) return;
    this.scorecardSaving = true;
    this.scorecardError = "";
    this.cdr.markForCheck();

    try {
      await this.trainerService.saveStudentScorecard({
        studentId: this.scorecardTargetStudent.id,
        technicalScore: this.scorecardForm.technicalScore,
        problemSolvingScore: this.scorecardForm.problemSolvingScore,
        communicationScore: this.scorecardForm.communicationScore,
        readinessStatus: this.scorecardForm.readinessStatus,
        feedback: this.scorecardForm.feedback,
        recommendedRole: this.scorecardForm.recommendedRole,
      });

      this.showNotification(`Scorecard evaluated for '${this.scorecardTargetStudent.name}'.`);
      this.closeScorecardModal();
      await this.loadScorecards();
    } catch (err: any) {
      this.scorecardError = err?.error?.message || err?.message || "Failed to save student scorecard.";
    } finally {
      this.scorecardSaving = false;
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // SECTION E: AVAILABILITY & ABSENCE
  // ==========================================
  async openAvailabilityModal(trainer: Trainer): Promise<void> {
    this.targetTrainerForAvailability = trainer;
    this.availabilityForm = {
      availability: trainer.availability || "AVAILABLE",
      absenceStartDate: trainer.absenceStartDate ? new Date(trainer.absenceStartDate).toISOString().slice(0, 10) : "",
      expectedReturnDate: trainer.expectedReturnDate ? new Date(trainer.expectedReturnDate).toISOString().slice(0, 10) : "",
      absenceReason: trainer.absenceReason || "",
    };
    this.absenceImpact = null;
    this.absenceReassignments = {};
    this.availabilityError = "";
    this.showAvailabilityModal = true;
    this.cdr.markForCheck();

    if (["ABSENT", "ON_LEAVE", "UNAVAILABLE"].includes(trainer.availability) || trainer.currentStudentCount > 0) {
      await this.fetchAbsenceImpact(trainer.id);
    }
  }

  closeAvailabilityModal(): void {
    this.showAvailabilityModal = false;
    this.targetTrainerForAvailability = null;
    this.absenceImpact = null;
    this.availabilityError = "";
    this.cdr.markForCheck();
  }

  async fetchAbsenceImpact(trainerId: string): Promise<void> {
    this.loadingAbsenceImpact = true;
    this.cdr.markForCheck();
    try {
      this.absenceImpact = await this.trainerService.getAbsenceImpact(trainerId);
      if (this.absenceImpact?.affectedStudents && this.absenceImpact?.eligibleReplacements.length) {
        const topReplacement = this.absenceImpact.eligibleReplacements.find((r) => r.remainingCapacity > 0);
        if (topReplacement) {
          for (const s of this.absenceImpact.affectedStudents) {
            this.absenceReassignments[s.id] = topReplacement.trainerId;
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch absence impact:", err);
    } finally {
      this.loadingAbsenceImpact = false;
      this.cdr.markForCheck();
    }
  }

  onAvailabilityStatusChange(): void {
    const isUnavailable = ["ABSENT", "ON_LEAVE", "UNAVAILABLE"].includes(this.availabilityForm.availability);
    if (isUnavailable && this.targetTrainerForAvailability) {
      this.fetchAbsenceImpact(this.targetTrainerForAvailability.id);
    }
  }

  async saveAvailability(): Promise<void> {
    if (!this.targetTrainerForAvailability) return;

    this.availabilitySaving = true;
    this.availabilityError = "";
    this.cdr.markForCheck();

    try {
      await this.trainerService.updateAvailability(this.targetTrainerForAvailability.id, {
        availability: this.availabilityForm.availability,
        absenceStartDate: this.availabilityForm.absenceStartDate || null,
        expectedReturnDate: this.availabilityForm.expectedReturnDate || null,
        absenceReason: this.availabilityForm.absenceReason,
      });

      this.showNotification(`Availability updated for '${this.targetTrainerForAvailability.name}'.`);

      const hasReassignments = Object.keys(this.absenceReassignments).length > 0;
      const isUnavailable = ["ABSENT", "ON_LEAVE", "UNAVAILABLE"].includes(this.availabilityForm.availability);

      if (isUnavailable && hasReassignments && this.absenceImpact?.affectedStudents.length) {
        this.openAbsenceReassignConfirmModal();
      } else {
        this.closeAvailabilityModal();
        await this.loadTrainers();
        await this.loadOverview();
      }
    } catch (err: any) {
      this.availabilityError = err?.error?.message || err?.message || "Failed to update availability.";
    } finally {
      this.availabilitySaving = false;
      this.cdr.markForCheck();
    }
  }

  openAbsenceReassignConfirmModal(): void {
    this.absenceReassignReason = `Trainer ${this.targetTrainerForAvailability?.name} marked ${this.availabilityForm.availability.toLowerCase().replace('_', ' ')}`;
    this.showAbsenceReassignConfirmModal = true;
    this.cdr.markForCheck();
  }

  closeAbsenceReassignConfirmModal(): void {
    this.showAbsenceReassignConfirmModal = false;
    this.closeAvailabilityModal();
    this.loadTrainers();
    this.loadOverview();
    this.cdr.markForCheck();
  }

  async confirmAbsenceReassignment(): Promise<void> {
    if (!this.targetTrainerForAvailability) return;

    const assignmentList = Object.entries(this.absenceReassignments)
      .filter(([_, targetTrainerId]) => Boolean(targetTrainerId))
      .map(([studentId, targetTrainerId]) => ({ studentId, targetTrainerId }));

    if (assignmentList.length === 0) {
      this.closeAbsenceReassignConfirmModal();
      return;
    }

    this.absenceReassignSaving = true;
    this.cdr.markForCheck();

    try {
      const res = await this.trainerService.reassignAbsenceStudents(
        this.targetTrainerForAvailability.id,
        assignmentList,
        this.absenceReassignReason
      );

      this.showNotification(`Successfully reassigned ${res.reassignedCount} affected students.`);
      this.closeAbsenceReassignConfirmModal();
      await this.loadStudents();
      await this.loadTrainers();
      await this.loadOverview();
      await this.loadHistory();
    } catch (err: any) {
      this.showNotification(err?.error?.message || "Failed to reassign affected students.", "error");
    } finally {
      this.absenceReassignSaving = false;
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // SECTION F: AUTOMATIC WORKLOAD DISTRIBUTION
  // ==========================================
  async openAutoAllocateModal(): Promise<void> {
    this.showAutoAllocateModal = true;
    this.loadingAutoAllocate = true;
    this.autoAllocationPreview = null;
    this.autoAllocateError = "";
    this.cdr.markForCheck();

    try {
      this.autoAllocationPreview = await this.trainerService.previewAutoAllocation();
    } catch (err: any) {
      this.autoAllocateError = err?.error?.message || err?.message || "Failed to calculate auto allocation preview.";
    } finally {
      this.loadingAutoAllocate = false;
      this.cdr.markForCheck();
    }
  }

  closeAutoAllocateModal(): void {
    this.showAutoAllocateModal = false;
    this.autoAllocationPreview = null;
    this.autoAllocateError = "";
    this.cdr.markForCheck();
  }

  async applyAutoAllocation(): Promise<void> {
    if (!this.autoAllocationPreview?.proposedAllocations?.length) return;

    this.applyingAutoAllocate = true;
    this.autoAllocateError = "";
    this.cdr.markForCheck();

    const assignments = this.autoAllocationPreview.proposedAllocations.map((p) => ({
      studentId: p.studentId,
      targetTrainerId: p.proposedTrainerId,
    }));

    try {
      const res = await this.trainerService.applyAutoAllocation(assignments);
      this.showNotification(`Auto allocation applied successfully! ${res.allocatedCount} students distributed.`);
      this.closeAutoAllocateModal();
      await this.loadStudents();
      await this.loadTrainers();
      await this.loadOverview();
      await this.loadHistory();
    } catch (err: any) {
      this.autoAllocateError = err?.error?.message || err?.message || "Failed to apply auto allocation.";
    } finally {
      this.applyingAutoAllocate = false;
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // SECTION G: ALLOCATION HISTORY
  // ==========================================
  async loadHistory(): Promise<void> {
    this.loadingHistory = true;
    this.cdr.markForCheck();
    try {
      this.historyRecords = await this.trainerService.getAllocationHistory({
        studentId: this.historySearch,
        courseName: this.historyCourseFilter !== "ALL" ? this.historyCourseFilter : undefined,
        action: this.historyActionFilter !== "ALL" ? this.historyActionFilter : undefined,
        limit: 100,
      });
    } catch (err: any) {
      console.error("Failed to load allocation history:", err);
    } finally {
      this.loadingHistory = false;
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // CSV EXPORTS (ITEM 6)
  // ==========================================
  async exportTrainers(): Promise<void> {
    try {
      const blob = await this.trainerService.downloadTrainersCsv();
      this.triggerDownload(blob, "TVK-Trainers-Directory.csv");
      this.showNotification("Trainers directory CSV exported.");
    } catch (err: any) {
      this.showNotification("Failed to export trainers CSV.", "error");
    }
  }

  async exportAllocations(): Promise<void> {
    try {
      const blob = await this.trainerService.downloadAllocationsCsv();
      this.triggerDownload(blob, "TVK-Student-Allocations.csv");
      this.showNotification("Student allocations CSV exported.");
    } catch (err: any) {
      this.showNotification("Failed to export allocations CSV.", "error");
    }
  }

  async exportHistory(): Promise<void> {
    try {
      const blob = await this.trainerService.downloadHistoryCsv();
      this.triggerDownload(blob, "TVK-Allocation-Audit-History.csv");
      this.showNotification("Allocation history CSV exported.");
    } catch (err: any) {
      this.showNotification("Failed to export history CSV.", "error");
    }
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Helpers
  getAvailabilityBadgeClass(availability: string): string {
    switch (availability) {
      case "AVAILABLE":
      case "PRESENT":
        return "badge-available";
      case "ABSENT":
      case "NOT_CHECKED_IN":
        return "badge-absent";
      case "ON_LEAVE":
        return "badge-leave";
      case "UNAVAILABLE":
        return "badge-unavailable";
      default:
        return "badge-neutral";
    }
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case "INITIAL_ALLOCATION":
        return "action-initial";
      case "REASSIGNMENT":
        return "action-reassign";
      case "ABSENCE_REASSIGNMENT":
        return "action-absence";
      case "AUTO_ALLOCATION":
        return "action-auto";
      default:
        return "action-neutral";
    }
  }

  formatAction(action: string): string {
    return (action || "").replace(/_/g, " ");
  }
}
