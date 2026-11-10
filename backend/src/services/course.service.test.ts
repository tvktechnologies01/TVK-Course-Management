import { describe, it, expect, beforeEach, vi } from "vitest";
import { CourseModel } from "../models/course.model";
import { CurriculumFileModel } from "../models/curriculum-file.model";
import { courseService } from "./course.service";
import { AuthenticatedAccount } from "../models/user.model";

describe("CourseService", () => {
  const managerAccount: AuthenticatedAccount = {
    id: "usr-mgr-1",
    username: "manager",
    email: "manager@tvk.com",
    name: "Admin Manager",
    role: "MANAGER",
    employeeId: "EMP-MGR-01",
    active: true,
    mustChangePassword: false,
  };

  const hrAccount: AuthenticatedAccount = {
    id: "usr-hr-1",
    username: "hr",
    email: "hr@tvk.com",
    name: "HR Recruiter",
    role: "HR",
    employeeId: "EMP-HR-01",
    active: true,
    mustChangePassword: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("seeds default courses if collection is empty", async () => {
    vi.spyOn(CourseModel, "countDocuments").mockResolvedValue(0 as any);
    const createSpy = vi.spyOn(CourseModel, "create").mockResolvedValue({} as any);

    await courseService.ensureDefaultCourses();
    expect(createSpy).toHaveBeenCalled();
  });

  it("prevents HR from creating a course", async () => {
    await expect(
      courseService.create(
        { name: "New Blockchain Course", category: "Web3", duration: "3 Months" },
        hrAccount,
      ),
    ).rejects.toThrow("Only Managers/Admins can add new courses.");
  });

  it("allows Manager to create a new course", async () => {
    vi.spyOn(CourseModel, "findOne").mockResolvedValue(null as any);
    vi.spyOn(CourseModel, "create").mockResolvedValue({
      _id: "CRS-100",
      name: "New AI Engineering",
      code: "TVK-AIE-17",
      category: "Data & AI",
      duration: "6 Months",
      toJSON: () => ({
        id: "CRS-100",
        name: "New AI Engineering",
        code: "TVK-AIE-17",
      }),
    } as any);

    const result = await courseService.create(
      {
        name: "New AI Engineering",
        code: "TVK-AIE-17",
        category: "Data & AI",
        duration: "6 Months",
      },
      managerAccount,
    );

    expect(result["name"]).toBe("New AI Engineering");
  });

  it("prevents HR from modifying/editing a course", async () => {
    await expect(
      courseService.update("CRS-100", { name: "Modified Name" }, hrAccount),
    ).rejects.toThrow("Only Managers/Admins can edit or modify courses.");
  });

  it("prevents HR from deleting a course", async () => {
    await expect(
      courseService.delete("CRS-100", hrAccount),
    ).rejects.toThrow("Only Managers/Admins can delete courses.");
  });

  it("prevents HR from uploading curriculum", async () => {
    const mockFile = {
      originalname: "curriculum.pdf",
      mimetype: "application/pdf",
      size: 1024,
      buffer: Buffer.from("pdf-data"),
    } as Express.Multer.File;

    await expect(
      courseService.uploadCurriculum("CRS-100", mockFile, hrAccount),
    ).rejects.toThrow("Only Managers/Admins can upload curriculum documents.");
  });

  it("allows Manager to upload curriculum and updates course record", async () => {
    const mockCourse = {
      id: "CRS-100",
      name: "DevOps Engineering",
      curriculumFileId: null,
      save: vi.fn().mockResolvedValue(true),
      toJSON: () => ({ id: "CRS-100", curriculumFileName: "devops-curriculum.pdf" }),
    };

    vi.spyOn(CourseModel, "findById").mockResolvedValue(mockCourse as any);
    vi.spyOn(CurriculumFileModel, "create").mockResolvedValue({ id: "FILE-1" } as any);

    const mockFile = {
      originalname: "devops-curriculum.pdf",
      mimetype: "application/pdf",
      size: 2048,
      buffer: Buffer.from("pdf-data"),
    } as Express.Multer.File;

    const result = await courseService.uploadCurriculum("CRS-100", mockFile, managerAccount);
    expect(result["curriculumFileName"]).toBe("devops-curriculum.pdf");
    expect(mockCourse.save).toHaveBeenCalled();
  });

  it("allows Manager to update specific duration track fee and prevents HR", async () => {
    const mockCourse = {
      id: "CRS-100",
      name: "Full Stack Development with Java & Angular",
      fees: 30000,
      tracks: [
        { duration: "15 Days", fees: 8000 },
        { duration: "1 Month", fees: 15000 },
        { duration: "3 Months", fees: 30000 },
        { duration: "6 Months", fees: 45000 },
      ],
      save: vi.fn().mockResolvedValue(true),
      toJSON: function () { return this; },
    };

    vi.spyOn(CourseModel, "findById").mockResolvedValue(mockCourse as any);

    // HR rejected
    await expect(
      courseService.updateTrackFee("CRS-100", "15 Days", 9500, hrAccount),
    ).rejects.toThrow("Only Managers/Admins can edit course duration track fees.");

    // Manager allowed
    const updated = await courseService.updateTrackFee("CRS-100", "15 Days", 9500, managerAccount);
    expect((updated as any).tracks[0].fees).toBe(9500);
    expect(mockCourse.save).toHaveBeenCalled();
  });

  it("automatically matches candidate course and duration to the right curriculum track", async () => {
    const mockJavaCourse = {
      id: "CRS-JAVA",
      name: "Full Stack Development with Java & Angular",
      tracks: [
        {
          duration: "15 Days",
          fees: 8000,
          curriculumFileId: "FILE-JAVA-15D",
          curriculumFileName: "Java-15-Days-CrashCourse.pdf",
          curriculumFileType: "PDF",
          curriculumFileSize: 10240,
        },
        {
          duration: "6 Months",
          fees: 45000,
          curriculumFileId: "FILE-JAVA-6M",
          curriculumFileName: "Java-6-Months-Master.pdf",
          curriculumFileType: "PDF",
          curriculumFileSize: 51200,
        },
      ],
    };

    const mockAiCourse = {
      id: "CRS-AIML",
      name: "AI with Machine Learning",
      tracks: [
        {
          duration: "15 Days",
          fees: 10000,
          curriculumFileId: "FILE-AI-15D",
          curriculumFileName: "AI-15-Days-Overview.pptx",
          curriculumFileType: "PPTX",
          curriculumFileSize: 20480,
        },
        {
          duration: "6 Months",
          fees: 50000,
          curriculumFileId: "FILE-AI-6M",
          curriculumFileName: "AI-6-Months-DeepDive.pdf",
          curriculumFileType: "PDF",
          curriculumFileSize: 81920,
        },
      ],
    };

    vi.spyOn(CourseModel, "countDocuments").mockResolvedValue(16 as any);
    vi.spyOn(CourseModel, "findOne").mockImplementation(((query: any) => {
      const reg = query.name as RegExp;
      if (reg.test(mockJavaCourse.name)) return Promise.resolve(mockJavaCourse as any);
      if (reg.test(mockAiCourse.name)) return Promise.resolve(mockAiCourse as any);
      return Promise.resolve(null as any);
    }) as any);

    // Case 1: Candidate selects Full Stack Java + 15 Days
    const case1 = await courseService.getCurriculumForCandidateCourse(
      "Full Stack Development with Java & Angular",
      "15 Days",
    );
    expect(case1.available).toBe(true);
    expect(case1.duration).toBe("15 Days");
    expect(case1.curriculumFileName).toBe("Java-15-Days-CrashCourse.pdf");
    expect(case1.fileId).toBe("FILE-JAVA-15D");

    // Case 2: Candidate selects AI with Machine Learning + 6 Months
    const case2 = await courseService.getCurriculumForCandidateCourse(
      "AI with Machine Learning",
      "6 Months",
    );
    expect(case2.available).toBe(true);
    expect(case2.duration).toBe("6 Months");
    expect(case2.curriculumFileName).toBe("AI-6-Months-DeepDive.pdf");
    expect(case2.fileId).toBe("FILE-AI-6M");

    // Case 3: Prefixed candidate registration course title (e.g. "Training - ...")
    const case3 = await courseService.getCurriculumForCandidateCourse(
      "Training - Full Stack Development with Java & Angular",
      "15 Days",
    );
    expect(case3.available).toBe(true);
    expect(case3.courseName).toBe("Full Stack Development with Java & Angular");
    expect(case3.duration).toBe("15 Days");
    expect(case3.curriculumFileName).toBe("Java-15-Days-CrashCourse.pdf");
  });
});
