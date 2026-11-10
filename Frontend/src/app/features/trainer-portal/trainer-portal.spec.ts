import "@angular/compiler";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { of, throwError } from "rxjs";
import { TrainerPortalComponent } from "./trainer-portal";

describe("TrainerPortalComponent", () => {
  let component: TrainerPortalComponent;
  let routerMock: { navigateByUrl: ReturnType<typeof vi.fn> };
  let portalServiceMock: {
    getMe: ReturnType<typeof vi.fn>;
    markAttendance: ReturnType<typeof vi.fn>;
    getAttendance: ReturnType<typeof vi.fn>;
    checkIn: ReturnType<typeof vi.fn>;
    getMyAttendance: ReturnType<typeof vi.fn>;
    downloadMyAttendanceCsv: ReturnType<typeof vi.fn>;
    getStudentSummary: ReturnType<typeof vi.fn>;
    saveScorecard: ReturnType<typeof vi.fn>;
    getScorecards: ReturnType<typeof vi.fn>;
    submitAbsence: ReturnType<typeof vi.fn>;
    resumeWork: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    getHolidays: ReturnType<typeof vi.fn>;
  };
  let cdrMock: { markForCheck: ReturnType<typeof vi.fn> };

  const mockProfile = {
    trainer: {
      id: "TRN-001",
      name: "Suresh Raina",
      email: "suresh@tvktech.com",
      availability: "AVAILABLE",
      specialization: "Java Full Stack",
      maxCapacity: 20,
      currentStudentCount: 2,
    },
    assignedStudentsCount: 2,
    assignedStudents: [
      {
        id: "CAN-001",
        name: "Arun Kumar",
        courseName: "Java Full Stack",
        batchId: "BATCH-1",
        email: "arun@example.com",
        phone: "9876500001",
      },
      {
        id: "CAN-002",
        name: "Bhavya Sri",
        courseName: "Java Full Stack",
        batchId: "BATCH-1",
        email: "bhavya@example.com",
        phone: "9876500002",
      },
    ],
    assignedBatches: [
      {
        id: "BATCH-1",
        batchName: "Morning Batch Alpha",
        courseName: "Java Full Stack",
        status: "ACTIVE",
      },
    ],
    recentAttendance: [],
  };

  beforeEach(() => {
    routerMock = { navigateByUrl: vi.fn().mockReturnValue(Promise.resolve(true)) };
    portalServiceMock = {
      getMe: vi.fn().mockReturnValue(of(mockProfile)),
      markAttendance: vi.fn().mockReturnValue(of({ success: true, message: "Attendance saved!", count: 2 })),
      getAttendance: vi.fn().mockReturnValue(
        of([
          {
            studentId: "CAN-001",
            studentName: "Arun Kumar",
            date: "2026-11-01",
            status: "PRESENT",
          },
          {
            studentId: "CAN-002",
            studentName: "Bhavya Sri",
            date: "2026-11-01",
            status: "ABSENT",
          },
        ])
      ),
      checkIn: vi.fn().mockReturnValue(
        of({
          success: true,
          message: "Check-in successful! Marked Present.",
          record: {
            date: "2026-11-02",
            status: "PRESENT",
            checkInTime: "2026-11-02T09:00:00.000Z",
          },
        })
      ),
      getMyAttendance: vi.fn().mockReturnValue(
        of({
          month: "2026-11",
          stats: { totalDaysLogged: 2, presentDays: 2, leaveDays: 0, absentDays: 0, attendanceRate: 100 },
          records: [
            { date: "2026-11-01", status: "PRESENT", checkInTime: "2026-11-01T09:15:00.000Z" },
            { date: "2026-11-02", status: "PRESENT", checkInTime: "2026-11-02T09:00:00.000Z" },
          ],
          todayRecord: { date: "2026-11-02", status: "PRESENT", checkInTime: "2026-11-02T09:00:00.000Z" },
        })
      ),
      downloadMyAttendanceCsv: vi.fn().mockReturnValue(
        of(new Blob(["Date,Status\n2026-11-02,PRESENT"], { type: "text/csv" }))
      ),
      getStudentSummary: vi.fn().mockReturnValue(
        of({
          student: mockProfile.assignedStudents[0],
          attendanceStats: {
            totalSessions: 10,
            presentCount: 9,
            lateCount: 0,
            absentCount: 1,
            attendancePercent: 90,
          },
          scorecards: [],
        })
      ),
      saveScorecard: vi.fn().mockReturnValue(of({ id: "SC-1", overallScore: 8.5 })),
      getScorecards: vi.fn().mockReturnValue(of([])),
      submitAbsence: vi.fn().mockReturnValue(of({ success: true, message: "Leave approved." })),
      resumeWork: vi.fn().mockReturnValue(of({ success: true, message: "Welcome back." })),
      changePassword: vi.fn().mockReturnValue(of({ success: true, message: "Password changed." })),
      logout: vi.fn(),
      getHolidays: vi.fn().mockReturnValue(of([{ date: "2026-11-11", name: "Diwali", type: "GOVERNMENT" }])),
    };
    cdrMock = { markForCheck: vi.fn() };

    component = new TrainerPortalComponent(
      portalServiceMock as any,
      routerMock as any,
      cdrMock as any
    );
  });

  it("should load profile on init and populate attendance mark rows", () => {
    component.ngOnInit();
    expect(portalServiceMock.getMe).toHaveBeenCalled();
    expect(component.profileData).toEqual(mockProfile);
    expect(component.markRows.length).toBe(2);
    expect(component.markRows[0].studentName).toBe("Arun Kumar");
    expect(component.markRows[0].status).toBe("PRESENT");
  });

  it("should switch tabs correctly and trigger tab-specific loaders", () => {
    component.ngOnInit();

    component.setTab("attendance-history");
    expect(component.activeTab).toBe("attendance-history");
    expect(portalServiceMock.getAttendance).toHaveBeenCalled();

    component.setTab("leave-request");
    expect(component.activeTab).toBe("leave-request");
  });

  it("should allow bulk setting attendance status to PRESENT, LATE, or ABSENT", () => {
    component.ngOnInit();
    component.setAllStatus("ABSENT");
    expect(component.markRows[0].status).toBe("ABSENT");
    expect(component.markRows[1].status).toBe("ABSENT");
    expect(component.getStatusCount("ABSENT")).toBe(2);

    component.setAllStatus("LATE");
    expect(component.getStatusCount("LATE")).toBe(2);
  });

  it("should save daily attendance and show success feedback", () => {
    component.ngOnInit();
    component.markTopic = "Angular Data Binding";
    component.saveAttendance();

    expect(portalServiceMock.markAttendance).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: "CAN-001",
          topicCovered: "Angular Data Binding",
        }),
      ])
    );
    expect(component.attendanceFeedback).toBe("Attendance saved!");
    expect(component.attendanceFeedbackType).toBe("success");
  });

  it("should compute monthly attendance matrix correctly", () => {
    component.ngOnInit();
    component.historyMonth = "2026-11";
    component.loadAttendanceHistory();

    const matrix = component.historyMatrixRows;
    expect(matrix.length).toBe(2);

    const arun = matrix.find((r) => r.studentId === "CAN-001");
    expect(arun).toBeDefined();
    expect(arun?.dayStatus[1]).toBe("PRESENT");
    expect(arun?.percent).toBe(100);

    const bhavya = matrix.find((r) => r.studentId === "CAN-002");
    expect(bhavya).toBeDefined();
    expect(bhavya?.dayStatus[1]).toBe("ABSENT");
    expect(bhavya?.percent).toBe(0);
  });

  it("should filter candidates by search query", () => {
    component.ngOnInit();
    expect(component.filteredStudents.length).toBe(2);

    component.studentSearchQuery = "Bhavya";
    expect(component.filteredStudents.length).toBe(1);
    expect(component.filteredStudents[0].name).toBe("Bhavya Sri");
  });

  it("should load candidate dossier summary modal", () => {
    component.ngOnInit();
    component.viewStudentSummary("CAN-001");

    expect(portalServiceMock.getStudentSummary).toHaveBeenCalledWith("CAN-001");
    expect(component.selectedStudentSummary).toBeDefined();
    expect(component.selectedStudentSummary.attendanceStats.attendancePercent).toBe(90);

    component.closeStudentSummary();
    expect(component.selectedStudentSummary).toBeNull();
  });

  it("should record daily check-in and update today attendance state", () => {
    component.ngOnInit();
    component.checkIn();

    expect(portalServiceMock.checkIn).toHaveBeenCalled();
    expect(component.todayWorkAttendance).toBeDefined();
    expect(component.todayWorkAttendance.status).toBe("PRESENT");
    expect(component.checkInFeedbackType).toBe("success");
  });

  it("should load trainer own monthly attendance register", () => {
    component.ngOnInit();
    component.loadMyAttendance("2026-11");

    expect(portalServiceMock.getMyAttendance).toHaveBeenCalledWith({ month: "2026-11" });
    expect(component.myAttendanceStats?.attendanceRate).toBe(100);
    expect(component.myAttendanceRecords.length).toBe(2);
  });

  it("should submit leave request with category & handover notes and refresh profile", () => {
    component.ngOnInit();
    component.leaveType = "SICK";
    component.leaveReason = "Fever and doctor rest advised";
    component.leaveHandoverNotes = "Please cover Spring Boot exception handling";
    component.submitLeaveRequest();

    expect(portalServiceMock.submitAbsence).toHaveBeenCalledWith({
      leaveType: "SICK",
      absenceReason: "Fever and doctor rest advised",
      absenceStartDate: component.leaveStartDate,
      expectedReturnDate: undefined,
      handoverNotes: "Please cover Spring Boot exception handling",
    });
    expect(component.leaveFeedbackType).toBe("success");
  });

  it("should resume duties when trainer returns from leave", () => {
    component.ngOnInit();
    component.resumeDuties();

    expect(portalServiceMock.resumeWork).toHaveBeenCalled();
    expect(component.leaveFeedbackType).toBe("success");
  });

  it("should validate and update password in profile settings", () => {
    component.ngOnInit();

    // Mismatched passwords
    component.currentPassword = "OldPassword123";
    component.newPassword = "NewSecretPassword1";
    component.confirmPassword = "DifferentPassword";
    component.changePassword();
    expect(component.passwordFeedbackType).toBe("error");
    expect(component.passwordFeedbackMsg).toContain("do not match");

    // Matching passwords
    component.confirmPassword = "NewSecretPassword1";
    component.changePassword();
    expect(portalServiceMock.changePassword).toHaveBeenCalledWith("OldPassword123", "NewSecretPassword1");
    expect(component.passwordFeedbackType).toBe("success");
  });

  it("should switch attendance range mode between monthly and weekly", () => {
    component.ngOnInit();
    component.setAttendanceRangeMode("weekly");
    expect(component.myAttendanceRangeMode).toBe("weekly");
    expect(component.myAttendanceWeekStart).toBeTruthy();
    expect(component.myAttendanceWeekEnd).toBeTruthy();
    expect(portalServiceMock.getMyAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: component.myAttendanceWeekStart,
        endDate: component.myAttendanceWeekEnd,
      })
    );
  });

  it("should export trainer own attendance CSV", () => {
    component.ngOnInit();
    component.exportMyAttendanceCsv();
    expect(portalServiceMock.downloadMyAttendanceCsv).toHaveBeenCalled();
  });

  it("should logout and redirect to /trainer-login", () => {
    component.logout();
    expect(portalServiceMock.logout).toHaveBeenCalled();
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith("/trainer-login");
  });
});
