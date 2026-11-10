import { describe, it, expect, vi, beforeEach } from "vitest";
import { trainerService } from "./trainer.service";
import { TrainerModel } from "../models/trainer.model";
import { HolidayModel } from "../models/holiday.model";
import { CandidateModel } from "../models/candidate.model";
import { CourseModel } from "../models/course.model";
import { CourseTrainerModel } from "../models/course-trainer.model";
import { TrainerAllocationHistoryModel } from "../models/trainer-allocation-history.model";
import { CounterModel } from "../models/counter.model";
import { AuthenticatedAccount } from "../models/user.model";

describe("TrainerService", () => {
  const mockActor: AuthenticatedAccount = {
    id: "mgr01",
    username: "admin",
    name: "Admin Manager",
    email: "manager@tvk.com",
    role: "MANAGER",
    employeeId: "EMP-MGR-01",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should create a trainer with sequential TVK-TR-00001 ID", async () => {
    (vi.spyOn(CounterModel, "findOneAndUpdate") as any).mockResolvedValue({ _id: "trainer_id", seq: 1 });
    vi.spyOn(TrainerModel, "findOne").mockResolvedValue(null as any);
    vi.spyOn(TrainerModel, "create").mockImplementation(async (doc: any) => ({
      ...doc,
      toJSON: () => ({ ...doc }),
    }) as any);

    const trainer = await trainerService.createTrainer(
      {
        name: "Suresh Kumar",
        email: "suresh@tvk.com",
        phone: "9876543210",
        qualification: "M.Tech CSE",
        specialization: "Full Stack Java",
        skills: ["Java", "Spring Boot", "Angular"],
        qualifiedCourses: ["Full Stack Java Development"],
        maxCapacity: 15,
      },
      mockActor
    );

    expect(trainer._id).toBe("TVK-TR-00001");
    expect(trainer.name).toBe("Suresh Kumar");
    expect(trainer.maxCapacity).toBe(15);
    expect(trainer.availability).toBe("AVAILABLE");
    expect(trainer.status).toBe("ACTIVE");
  });

  it("should reject creating a trainer with duplicate email", async () => {
    vi.spyOn(TrainerModel, "findOne").mockResolvedValue({ _id: "TVK-TR-00001", email: "existing@tvk.com" } as any);

    await expect(
      trainerService.createTrainer(
        {
          name: "Duplicate Trainer",
          email: "existing@tvk.com",
        },
        mockActor
      )
    ).rejects.toThrow("already exists");
  });

  it("should allocate student to trainer and track allocation history", async () => {
    const mockStudent: any = {
      _id: "TVK-26-00001",
      name: "Ramesh Babu",
      courseName: "Full Stack Java Development",
      trainerId: null,
      trainerName: null,
      trainerAllocationStatus: "UNASSIGNED",
      save: vi.fn().mockResolvedValue(true),
    };

    const mockTrainer = {
      _id: "TVK-TR-00001",
      name: "Suresh Kumar",
      email: "suresh@tvk.com",
      status: "ACTIVE",
      availability: "AVAILABLE",
      maxCapacity: 20,
    };

    vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockStudent as any);
    vi.spyOn(TrainerModel, "findById").mockResolvedValue(mockTrainer as any);
    vi.spyOn(CandidateModel, "countDocuments").mockResolvedValue(5);
    vi.spyOn(TrainerModel, "find").mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: "TVK-TR-00001" }]),
      }),
    } as any);
    vi.spyOn(TrainerModel, "updateOne").mockResolvedValue({} as any);
    const historySpy = vi.spyOn(TrainerAllocationHistoryModel, "create").mockResolvedValue({} as any);

    await trainerService.allocateStudent("TVK-26-00001", "TVK-TR-00001", "Initial training allocation", mockActor);

    expect(mockStudent.trainerId).toBe("TVK-TR-00001");
    expect(mockStudent.trainerName).toBe("Suresh Kumar");
    expect(mockStudent.trainerAllocationStatus).toBe("ASSIGNED");
    expect(mockStudent.save).toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "TVK-26-00001",
        newTrainerId: "TVK-TR-00001",
        action: "INITIAL_ALLOCATION",
      })
    );
  });

  it("should enforce capacity limit when allocating student", async () => {
    const mockStudent = {
      _id: "TVK-26-00002",
      name: "Anitha S",
      courseName: "Python AI",
    };

    const mockTrainer = {
      _id: "TVK-TR-00002",
      name: "Priya Sharma",
      status: "ACTIVE",
      availability: "AVAILABLE",
      maxCapacity: 10,
    };

    vi.spyOn(CandidateModel, "findById").mockResolvedValue(mockStudent as any);
    vi.spyOn(TrainerModel, "findById").mockResolvedValue(mockTrainer as any);
    // Already at 10 students
    vi.spyOn(CandidateModel, "countDocuments").mockResolvedValue(10);

    await expect(
      trainerService.allocateStudent("TVK-26-00002", "TVK-TR-00002", undefined, mockActor)
    ).rejects.toThrow("reached maximum student capacity");
  });

  it("should preview automatic workload distribution across eligible trainers", async () => {
    vi.spyOn(TrainerModel, "find").mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([]),
      }),
    } as any);

    // 2 unassigned students in Java
    vi.spyOn(CandidateModel, "find").mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { _id: "s1", name: "Student 1", courseName: "Java Full Stack" },
            { _id: "s2", name: "Student 2", courseName: "Java Full Stack" },
          ]),
      }),
    } as any);

    const mockTrainers = [
      {
        _id: "t1",
        name: "Trainer 1",
        status: "ACTIVE",
        availability: "AVAILABLE",
        maxCapacity: 10,
        currentStudentCount: 2,
        qualifiedCourses: ["Java Full Stack"],
      },
    ];

    (vi.spyOn(TrainerModel, "find") as any).mockImplementation((query: any) => {
      if (query?.status === "ACTIVE") {
        return {
          lean: () => Promise.resolve(mockTrainers),
        } as any;
      }
      return {
        select: () => ({
          lean: () => Promise.resolve([]),
        }),
      } as any;
    });

    const preview = await trainerService.previewAutoAllocation();

    expect(preview.totalUnassigned).toBe(2);
    expect(preview.allocatableCount).toBe(2);
    expect(preview.proposedAllocations).toHaveLength(2);
    expect(preview.proposedAllocations[0].proposedTrainerId).toBe("t1");
  });

  it("should authenticate trainer with valid credentials and return JWT token", async () => {
    const mockTrainerDoc = {
      _id: "TVK-TR-00001",
      name: "Suresh Kumar",
      email: "suresh@tvk.com",
      status: "ACTIVE",
      accountPassword: "TVK@Trainer2026",
      mustChangePassword: true,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(TrainerModel, "findOne").mockReturnValue({
      select: () => Promise.resolve(mockTrainerDoc),
    } as any);

    const loginResult = await trainerService.trainerLogin("TVK-TR-00001", "TVK@Trainer2026");

    expect(loginResult).toBeDefined();
    expect(loginResult.token).toBeTruthy();
    expect(loginResult.trainer.name).toBe("Suresh Kumar");
    expect(loginResult.mustChangePassword).toBe(true);
    expect(mockTrainerDoc.save).toHaveBeenCalled();
  });

  it("should reject trainer login with invalid password", async () => {
    const mockTrainerDoc = {
      _id: "TVK-TR-00001",
      name: "Suresh Kumar",
      email: "suresh@tvk.com",
      status: "ACTIVE",
      accountPassword: "TVK@Trainer2026",
    };

    vi.spyOn(TrainerModel, "findOne").mockReturnValue({
      select: () => Promise.resolve(mockTrainerDoc),
    } as any);

    await expect(
      trainerService.trainerLogin("TVK-TR-00001", "WrongPassword123")
    ).rejects.toThrow("Invalid Trainer ID / Email or Password.");
  });

  it("should reset trainer password and return a new default password", async () => {
    const mockTrainerDoc = {
      _id: "TVK-TR-00001",
      accountPassword: "old",
      accountPasswordHash: "hash",
      mustChangePassword: false,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(TrainerModel, "findById").mockResolvedValue(mockTrainerDoc as any);

    const result = await trainerService.resetTrainerPassword("TVK-TR-00001", mockActor);

    expect(result.defaultPassword).toMatch(/^TVK@Trainer\d{4}$/);
    expect(mockTrainerDoc.mustChangePassword).toBe(true);
    expect(mockTrainerDoc.save).toHaveBeenCalled();
  });

  it("should calculate batch schedule skipping weekends and declared institutional holidays (Case 1)", async () => {
    vi.spyOn(HolidayModel, "find").mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve([
          { _id: "HOL-2026-11-11", date: "2026-11-11", name: "Deepavali", type: "GOVERNMENT" },
        ]),
      }),
      lean: () => Promise.resolve([
        { _id: "HOL-2026-11-11", date: "2026-11-11", name: "Deepavali", type: "GOVERNMENT" },
      ]),
    } as any);

    const schedule = await trainerService.calculateBatchSchedule({
      startDate: "2026-11-02",
      totalSessions: 15,
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    });

    expect(schedule.totalSessions).toBe(15);
    expect(schedule.endDate).toBe("2026-11-23");
    expect(schedule.skippedHolidays.length).toBe(1);
    expect(schedule.skippedHolidays[0].name).toBe("Deepavali");
    expect(schedule.skippedWeekendDays).toBe(6);
  });
});
