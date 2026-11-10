import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { of } from "rxjs";
import { TrainerManagementComponent } from "./trainer-management";
import { TrainerOverview } from "../../core/models/trainer.model";

describe("TrainerManagementComponent", () => {
  let component: TrainerManagementComponent;
  let trainerServiceMock: any;
  let courseServiceMock: any;
  let cdrMock: any;

  const mockOverview: TrainerOverview = {
    totalTrainers: 5,
    availableTrainers: 4,
    absentTrainers: 1,
    totalActiveStudents: 25,
    unassignedStudents: 6,
    coursesWithoutTrainers: 1,
    trainerWorkloads: [
      {
        id: "TVK-TR-00001",
        name: "Suresh Kumar",
        email: "suresh@tvk.com",
        specialization: "Full Stack Java",
        skills: ["Java", "Spring Boot"],
        assignedCourses: ["Java Full Stack"],
        qualifiedCourses: ["Java Full Stack"],
        employmentType: "FULL_TIME",
        maxCapacity: 20,
        currentStudentCount: 5,
        remainingCapacity: 15,
        utilizationPercent: 25,
        availability: "AVAILABLE",
        status: "ACTIVE",
        absenceStartDate: null,
        expectedReturnDate: null,
        actualReturnDate: null,
      },
    ],
    absentTrainersWithStudents: [
      {
        trainerId: "TVK-TR-00001",
        trainerName: "Suresh Kumar",
        trainerEmail: "suresh@tvk.com",
        availability: "ABSENT",
        absenceReason: "Medical leave",
        absenceStartDate: "2026-11-01",
        expectedReturnDate: "2026-11-10",
        affectedStudentCount: 5,
        qualifiedCourses: ["Java Full Stack"],
      },
    ],
  };

  const mockStudents = [
    {
      id: "TVK-26-00001",
      name: "Ramesh Babu",
      email: "ramesh@test.com",
      phone: "9876543210",
      enrolledCourse: "Java Full Stack",
      trainerId: null,
      trainerName: null,
      trainerEmail: null,
      trainerAssignedAt: null,
      trainerAllocationStatus: "UNASSIGNED",
    },
  ];

  beforeEach(() => {
    trainerServiceMock = {
      getOverview: vi.fn().mockResolvedValue(mockOverview),
      getTrainers: vi.fn().mockResolvedValue(mockOverview.trainerWorkloads),
      getTrainerById: vi.fn().mockResolvedValue({
        trainer: mockOverview.trainerWorkloads[0],
        assignedStudents: [],
        assignedCoursesDetails: [],
      }),
      createTrainer: vi.fn().mockResolvedValue({ id: "TVK-TR-00002", name: "New Trainer" }),
      updateTrainer: vi.fn().mockResolvedValue(mockOverview.trainerWorkloads[0]),
      toggleTrainerStatus: vi.fn().mockResolvedValue(mockOverview.trainerWorkloads[0]),
      getCourseAllocations: vi.fn().mockResolvedValue([]),
      setCourseAllocation: vi.fn().mockResolvedValue({}),
      removeCourseAllocation: vi.fn().mockResolvedValue({}),
      getEligibleStudents: vi.fn().mockResolvedValue(mockStudents),
      allocateStudent: vi.fn().mockResolvedValue({}),
      allocateBulkStudents: vi.fn().mockResolvedValue({ allocatedCount: 1 }),
      updateAvailability: vi.fn().mockResolvedValue({}),
      getAbsenceImpact: vi.fn().mockResolvedValue({
        trainer: mockOverview.trainerWorkloads[0],
        affectedStudents: [],
        eligibleReplacements: [],
      }),
      reassignAbsenceStudents: vi.fn().mockResolvedValue({ reassignedCount: 0 }),
      previewAutoAllocation: vi.fn().mockResolvedValue({
        totalUnassigned: 1,
        allocatableCount: 1,
        unallocatableCount: 0,
        proposedAllocations: [],
        courseBreakdowns: [],
        warnings: [],
      }),
      applyAutoAllocation: vi.fn().mockResolvedValue({ allocatedCount: 1 }),
      getAllocationHistory: vi.fn().mockResolvedValue([]),
      getBatches: vi.fn().mockResolvedValue([{ id: "batch-1", batchName: "FS-JAVA-01", courseName: "Java Full Stack", trainerId: "TVK-TR-00001", status: "ACTIVE" }]),
      createBatch: vi.fn().mockResolvedValue({ id: "batch-2", batchName: "FS-JAVA-02" }),
      updateBatch: vi.fn().mockResolvedValue({ id: "batch-1" }),
      deleteBatch: vi.fn().mockResolvedValue({}),
      markAttendance: vi.fn().mockResolvedValue({ success: true, count: 1 }),
      getAttendance: vi.fn().mockResolvedValue([
        {
          id: "att-1",
          studentId: "TVK-26-00001",
          studentName: "Ramesh Babu",
          courseName: "Java Full Stack",
          trainerId: "TVK-TR-00001",
          trainerName: "Suresh Kumar",
          date: "2026-11-02",
          status: "PRESENT",
          topicCovered: "Spring Boot Microservices",
          markedBy: "Suresh Kumar",
        },
      ]),
      getStudentTrainingSummary: vi.fn().mockResolvedValue({
        student: { id: "TVK-26-00001", name: "Ramesh Babu", email: "ramesh@test.com", enrolledCourse: "Java Full Stack" },
        attendanceStats: { totalSessions: 10, presentCount: 9, lateCount: 1, absentCount: 0, attendancePercent: 100 },
        recentAttendance: [],
        scorecards: [],
        assignedTrainer: { id: "TVK-TR-00001", name: "Suresh Kumar" },
      }),
      getStudentScorecards: vi.fn().mockResolvedValue([{ studentId: "TVK-26-00001", technicalScore: 9, problemSolvingScore: 8, communicationScore: 9, readinessStatus: "READY" }]),
      saveStudentScorecard: vi.fn().mockResolvedValue({ id: "sc-1" }),
      downloadTrainersCsv: vi.fn().mockResolvedValue(new Blob(["id,name\nTVK-TR-00001,Suresh"], { type: "text/csv" })),
      downloadAllocationsCsv: vi.fn().mockResolvedValue(new Blob(["studentId,trainerId\n"], { type: "text/csv" })),
      downloadHistoryCsv: vi.fn().mockResolvedValue(new Blob(["timestamp,action\n"], { type: "text/csv" })),
      getFacultyDailyAttendance: vi.fn().mockResolvedValue({
        date: "2026-11-02",
        stats: { totalFaculty: 5, present: 4, onLeave: 1, absent: 0 },
        records: [],
        alerts: [],
      }),
      acknowledgeFacultyAbsence: vi.fn().mockResolvedValue({
        success: true,
        message: "Absence acknowledged.",
      }),
      managerCheckInTrainer: vi.fn().mockResolvedValue({
        success: true,
        message: "Trainer checked in successfully.",
        record: { status: "PRESENT" },
      }),
      getFacultyAttendanceHistory: vi.fn().mockResolvedValue({
        stats: { totalDays: 1, presentDays: 1, leaveDays: 0, absentDays: 0, attendancePercentage: 100 },
        records: [],
      }),
      downloadFacultyAttendanceCsv: vi.fn().mockResolvedValue(
        new Blob(["Date,Trainer ID\n2026-11-02,TVK-TR-00001"], { type: "text/csv" })
      ),
      getHolidays: vi.fn().mockResolvedValue([
        { id: "HOL-1", date: "2026-11-11", name: "Diwali", type: "GOVERNMENT" }
      ]),
      createHoliday: vi.fn().mockResolvedValue({ id: "HOL-2", date: "2026-12-25", name: "Christmas", type: "GOVERNMENT" }),
      deleteHoliday: vi.fn().mockResolvedValue(undefined),
      calculateBatchSchedule: vi.fn().mockResolvedValue({
        startDate: "2026-11-02",
        endDate: "2026-11-23",
        totalSessions: 15,
        calendarDaysSpan: 22,
        sessionDates: [],
        skippedHolidays: [{ date: "2026-11-11", name: "Diwali" }],
        skippedWeekendDays: 6,
      }),
    };

    courseServiceMock = {
      list: vi.fn().mockReturnValue(of([{ id: "c1", name: "Java Full Stack", status: "ACTIVE" }])),
    };

    cdrMock = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn(),
    };

    component = new TrainerManagementComponent(trainerServiceMock, courseServiceMock, cdrMock);
  });

  it("should initialize and load overview, trainers, and active courses", async () => {
    await component.ngOnInit();

    expect(trainerServiceMock.getOverview).toHaveBeenCalled();
    expect(trainerServiceMock.getTrainers).toHaveBeenCalled();
    expect(courseServiceMock.list).toHaveBeenCalled();
    expect(component.overview).toEqual(mockOverview);
    expect(component.trainers).toHaveLength(1);
    expect(component.activeCourses).toHaveLength(1);
  });

  it("should switch tabs seamlessly within the single component", () => {
    component.switchTab("trainers");
    expect(component.selectedTab).toBe("trainers");

    component.switchTab("courses");
    expect(component.selectedTab).toBe("courses");

    component.switchTab("students");
    expect(component.selectedTab).toBe("students");

    component.switchTab("availability");
    expect(component.selectedTab).toBe("availability");

    component.switchTab("history");
    expect(component.selectedTab).toBe("history");
  });

  it("should filter overview metrics when summary cards are clicked", () => {
    component.filterByOverviewCard("unassigned");
    expect(component.selectedTab).toBe("students");
    expect(component.studentAllocationFilter).toBe("UNASSIGNED");

    component.filterByOverviewCard("available");
    expect(component.selectedTab).toBe("trainers");
    expect(component.trainerAvailabilityFilter).toBe("AVAILABLE");
  });

  it("should toggle student selection for bulk allocation", async () => {
    await component.loadStudents();

    component.toggleStudentSelection("TVK-26-00001");
    expect(component.selectedStudentIds.has("TVK-26-00001")).toBe(true);

    component.toggleStudentSelection("TVK-26-00001");
    expect(component.selectedStudentIds.has("TVK-26-00001")).toBe(false);
  });

  it("should open and close modals cleanly", () => {
    component.openAddTrainerModal();
    expect(component.showTrainerModal).toBe(true);
    expect(component.isEditingTrainer).toBe(false);

    component.closeTrainerModal();
    expect(component.showTrainerModal).toBe(false);
  });

  it("should manage batches and schedules in batches tab", async () => {
    component.switchTab("batches");
    expect(component.selectedTab).toBe("batches");
    expect(trainerServiceMock.getBatches).toHaveBeenCalled();

    component.openAddBatchModal();
    expect(component.showBatchModal).toBe(true);
    expect(component.isEditingBatch).toBe(false);

    component.batchForm.batchName = "FS-JAVA-02";
    component.batchForm.courseName = "Java Full Stack";
    component.batchForm.trainerId = "TVK-TR-00001";
    await component.saveBatch();

    expect(trainerServiceMock.createBatch).toHaveBeenCalled();
    expect(component.showBatchModal).toBe(false);
  });

  it("should log daily attendance and evaluate student scorecards", async () => {
    component.switchTab("attendance");
    expect(component.selectedTab).toBe("attendance");
    expect(trainerServiceMock.getStudentScorecards).toHaveBeenCalled();

    component.attendanceItems = [
      {
        studentId: "TVK-26-00001",
        studentName: "Ramesh Babu",
        courseName: "Java Full Stack",
        trainerId: "TVK-TR-00001",
        trainerName: "Suresh Kumar",
        status: "PRESENT",
        topicCovered: "Spring Boot Microservices",
        remarks: "Good engagement",
      },
    ];

    await component.saveAttendanceBatch();
    expect(trainerServiceMock.markAttendance).toHaveBeenCalled();

    component.openScorecardModal(mockStudents[0] as any);
    expect(component.showScorecardModal).toBe(true);
    component.scorecardForm.technicalScore = 9;
    await component.saveScorecard();
    expect(trainerServiceMock.saveStudentScorecard).toHaveBeenCalled();
    expect(component.showScorecardModal).toBe(false);
  });

  it("should trigger CSV exports for trainers, allocations, and history", async () => {
    const triggerSpy = vi.spyOn(component as any, "triggerDownload").mockImplementation(() => {});

    await component.exportTrainers();
    expect(trainerServiceMock.downloadTrainersCsv).toHaveBeenCalled();
    expect(triggerSpy).toHaveBeenCalledWith(expect.any(Blob), "TVK-Trainers-Directory.csv");

    await component.exportAllocations();
    expect(trainerServiceMock.downloadAllocationsCsv).toHaveBeenCalled();
    expect(triggerSpy).toHaveBeenCalledWith(expect.any(Blob), "TVK-Student-Allocations.csv");

    await component.exportHistory();
    expect(trainerServiceMock.downloadHistoryCsv).toHaveBeenCalled();
    expect(triggerSpy).toHaveBeenCalledWith(expect.any(Blob), "TVK-Allocation-Audit-History.csv");
  });

  it("should calculate affected students and trigger one-click absence resolution", async () => {
    await component.ngOnInit();

    expect(component.getTotalAbsentAffectedStudents()).toBe(5);
    expect(component.isTrainerAbsent("TVK-TR-00001")).toBe(true);
    expect(component.isTrainerAbsent("TVK-TR-99999")).toBe(false);

    const openAvailSpy = vi.spyOn(component, "openAvailabilityModal").mockImplementation(async () => {});
    await component.resolveTrainerAbsence();
    expect(openAvailSpy).toHaveBeenCalled();
  });

  it("should open trainer roster modal and filter students assigned to trainer (Phase 1)", async () => {
    await component.ngOnInit();
    const trainer = mockOverview.trainerWorkloads[0];
    component.students = [
      {
        id: "TVK-26-00001",
        name: "Ramesh Babu",
        email: "ramesh@test.com",
        phone: "9876543210",
        enrolledCourse: "Java Full Stack",
        trainerId: "TVK-TR-00001",
        trainerName: "Suresh Kumar",
        trainerEmail: "suresh@tvk.com",
        trainerAssignedAt: "2026-11-01",
        trainerAllocationStatus: "ASSIGNED",
      },
    ];

    await component.openTrainerRoster(trainer);
    expect(component.showTrainerRosterModal).toBe(true);
    expect(component.selectedRosterTrainer).toEqual(trainer);
    expect(component.rosterStudents.length).toBe(1);
    expect(component.rosterStudents[0].name).toBe("Ramesh Babu");

    component.closeTrainerRoster();
    expect(component.showTrainerRosterModal).toBe(false);
  });

  it("should fetch student training summary and render 360 profile (Phase 1)", async () => {
    await component.viewStudentDetail("TVK-26-00001");
    expect(trainerServiceMock.getStudentTrainingSummary).toHaveBeenCalledWith("TVK-26-00001");
    expect(component.showStudentDetailModal).toBe(true);
    expect(component.studentDetailSummary?.student?.name).toBe("Ramesh Babu");
    expect(component.studentDetailSummary?.attendanceStats?.attendancePercent).toBe(100);

    component.closeStudentDetail();
    expect(component.showStudentDetailModal).toBe(false);
  });

  it("should load saved attendance records and compute attendance rate statistics (Phase 1)", async () => {
    await component.loadSavedAttendance();
    expect(trainerServiceMock.getAttendance).toHaveBeenCalled();
    expect(component.savedAttendanceRecords.length).toBe(1);

    const summary = component.savedAttendanceSummary;
    expect(summary.total).toBe(1);
    expect(summary.present).toBe(1);
    expect(summary.percent).toBe(100);

    // Quick mark all present
    component.attendanceItems = [
      {
        studentId: "TVK-26-00001",
        studentName: "Ramesh Babu",
        courseName: "Java Full Stack",
        trainerId: "TVK-TR-00001",
        trainerName: "Suresh Kumar",
        status: "ABSENT",
        topicCovered: "",
        remarks: "",
      },
    ];
    component.markAllAttendanceStatus("PRESENT");
    expect(component.attendanceItems[0].status).toBe("PRESENT");
  });

  it("should load faculty attendance history in monthly and weekly modes", async () => {
    await component.loadFacultyAttendanceHistory();
    expect(trainerServiceMock.getFacultyAttendanceHistory).toHaveBeenCalled();
    expect(component.facultyHistoryStats).toBeDefined();

    component.setFacultyHistoryRangeMode("weekly");
    expect(component.facultyHistoryRangeMode).toBe("weekly");
    expect(component.facultyHistoryWeekStart).toBeTruthy();
    expect(component.facultyHistoryWeekEnd).toBeTruthy();
  });

  it("should export faculty attendance register CSV", async () => {
    await component.exportFacultyHistoryCsv();
    expect(trainerServiceMock.downloadFacultyAttendanceCsv).toHaveBeenCalled();
  });

  it("should open faculty register view directly", () => {
    component.openFacultyRegister("weekly");
    expect(component.selectedTab).toBe("attendance");
    expect(component.attendanceSubView).toBe("FACULTY_REGISTER");
    expect(component.facultyHistoryRangeMode).toBe("weekly");
  });

  it("should load, add, and delete institutional holidays", async () => {
    await component.loadInstitutionalHolidays();
    expect(trainerServiceMock.getHolidays).toHaveBeenCalled();
    expect(component.institutionalHolidays.length).toBe(1);

    component.holidayForm = {
      date: "2026-12-25",
      name: "Christmas",
      type: "GOVERNMENT",
      description: "Christmas day",
    };
    await component.saveInstitutionalHoliday();
    expect(trainerServiceMock.createHoliday).toHaveBeenCalled();

    // Call delete
    await component.deleteInstitutionalHoliday("HOL-1");
    expect(trainerServiceMock.deleteHoliday).toHaveBeenCalledWith("HOL-1");
  });

  it("should calculate batch schedule skipping holidays and non-working days", async () => {
    component.batchForm.startDate = "2026-11-02";
    component.batchForm.totalSessions = 15;
    component.batchForm.days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

    await component.autoCalculateBatchEndDate();
    expect(trainerServiceMock.calculateBatchSchedule).toHaveBeenCalledWith({
      startDate: "2026-11-02",
      totalSessions: 15,
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    });
    expect(component.batchForm.endDate).toBe("2026-11-23");
    expect(component.batchScheduleCalc?.skippedHolidays.length).toBe(1);
  });
});
