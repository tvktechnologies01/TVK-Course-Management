import "@angular/compiler";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { of } from "rxjs";
import { CourseManagementComponent } from "./course-management";
import { Course } from "../../core/models/course.model";

describe("CourseManagementComponent", () => {
  let component: CourseManagementComponent;
  let courseServiceMock: any;
  let authServiceManagerMock: any;
  let authServiceHrMock: any;

  const sampleCourses: Course[] = [
    {
      id: "CRS-001",
      name: "Full Stack Development with Java & Angular",
      code: "TVK-FSJ-01",
      category: "Full Stack & Web",
      duration: "3 Months",
      mode: "Online / Offline",
      fees: 30000,
      description: "End-to-end full stack program",
      keyTopics: ["Java", "Spring Boot", "Angular"],
      status: "ACTIVE",
      curriculumFileId: "FILE-01",
      curriculumFileName: "java-angular-curriculum.pdf",
      curriculumFileType: "PDF",
      curriculumFileSize: 1048576,
      curriculumUploadedAt: new Date().toISOString(),
      lastModifiedBy: "Admin Manager",
      tracks: [
        { duration: "15 Days", fees: 8000, curriculumFileId: "FILE-15D", curriculumFileName: "java-15d.pdf", curriculumFileType: "PDF" },
        { duration: "1 Month", fees: 15000, curriculumFileId: null },
        { duration: "3 Months", fees: 30000, curriculumFileId: "FILE-01", curriculumFileName: "java-angular-curriculum.pdf", curriculumFileType: "PDF" },
        { duration: "6 Months", fees: 45000, curriculumFileId: null },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "CRS-002",
      name: "DevOps Engineering",
      code: "TVK-DVO-02",
      category: "Cloud & Infrastructure",
      duration: "3 Months",
      mode: "Online / Offline",
      fees: 35000,
      description: "CI/CD, Docker and Kubernetes",
      keyTopics: ["Docker", "Kubernetes", "Jenkins"],
      status: "ACTIVE",
      curriculumFileId: null,
      curriculumFileName: "",
      curriculumFileType: "",
      curriculumFileSize: 0,
      curriculumUploadedAt: null,
      lastModifiedBy: "Admin Manager",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    if (typeof (globalThis as any).window === "undefined") {
      (globalThis as any).window = {
        URL: {
          createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
          revokeObjectURL: vi.fn(),
        },
      };
    }
    if (typeof (globalThis as any).document === "undefined") {
      (globalThis as any).document = {
        createElement: vi.fn().mockReturnValue({ click: vi.fn() }),
      };
    }

    courseServiceMock = {
      list: vi.fn().mockReturnValue(of(sampleCourses)),
      create: vi.fn().mockImplementation((payload) => of({ ...sampleCourses[0], id: "CRS-003", ...payload })),
      update: vi.fn().mockReturnValue(of({ ...sampleCourses[0], name: "Updated Course" })),
      delete: vi.fn().mockReturnValue(of({ success: true, deletedId: "CRS-002" })),
      uploadCurriculum: vi.fn().mockReturnValue(of({
        ...sampleCourses[1],
        curriculumFileId: "FILE-02",
        curriculumFileName: "devops.pptx",
        curriculumFileType: "PPTX",
      })),
      deleteCurriculum: vi.fn().mockReturnValue(of({ ...sampleCourses[0], curriculumFileId: null })),
      downloadCurriculum: vi.fn().mockReturnValue(of(new Blob(["curriculum-content"]))),
      updateTrackFee: vi.fn().mockImplementation((id, duration, fees) => {
        const c = { ...sampleCourses[0], id };
        c.tracks = (c.tracks || []).map((t) => (t.duration === duration ? { ...t, fees } : t));
        return of(c);
      }),
      uploadTrackCurriculum: vi.fn().mockImplementation((id, duration, file) => {
        const c = { ...sampleCourses[0], id };
        c.tracks = (c.tracks || []).map((t) =>
          t.duration === duration
            ? { ...t, curriculumFileId: "NEW-FILE", curriculumFileName: file.name, curriculumFileType: "PDF" }
            : t,
        );
        return of(c);
      }),
      deleteTrackCurriculum: vi.fn().mockImplementation((id, duration) => {
        const c = { ...sampleCourses[0], id };
        c.tracks = (c.tracks || []).map((t) => (t.duration === duration ? { ...t, curriculumFileId: null } : t));
        return of(c);
      }),
      downloadTrackCurriculum: vi.fn().mockReturnValue(of(new Blob(["track-curriculum-content"]))),
    };

    authServiceManagerMock = {
      role: "MANAGER",
      user: { name: "Admin Manager" },
    };

    authServiceHrMock = {
      role: "HR",
      user: { name: "Priya HR" },
    };
  });

  it("should initialize and load course catalog for Manager", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    expect(courseServiceMock.list).toHaveBeenCalledOnce();
    expect(component.courses.length).toBe(2);
    expect(component.filteredCourses.length).toBe(2);
    expect(component.isManager).toBe(true);
    expect(component.isHr).toBe(false);
  });

  it("should initialize in read-only / verification mode for HR", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceHrMock);
    component.ngOnInit();

    expect(component.isManager).toBe(false);
    expect(component.isHr).toBe(true);

    // HR cannot trigger manager-only operations
    component.openAddCourseModal();
    expect(component.showCourseModal).toBe(false);
  });

  it("allows Manager to open add course modal and submit new course", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    component.openAddCourseModal();
    expect(component.showCourseModal).toBe(true);

    component.courseName = "AI and Generative Models";
    component.courseCode = "TVK-AI-03";
    component.courseCategory = "Data & AI";
    component.courseDuration = "6 Months";
    component.courseFees = 45000;
    component.courseKeyTopics = "LLMs, LangChain, Python";

    component.saveCourse();

    expect(courseServiceMock.create).toHaveBeenCalledOnce();
    expect(component.showCourseModal).toBe(false);
    expect(component.successMessage).toContain("AI and Generative Models");
  });

  it("allows Manager to open edit course modal and update details", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    component.openEditCourseModal(sampleCourses[0]);
    expect(component.showCourseModal).toBe(true);
    expect(component.courseName).toBe("Full Stack Development with Java & Angular");

    component.courseName = "Full Stack Java & Angular Enterprise";
    component.saveCourse();

    expect(courseServiceMock.update).toHaveBeenCalledOnce();
    expect(component.showCourseModal).toBe(false);
  });

  it("allows Manager to delete a course after confirmation", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    component.confirmDelete(sampleCourses[1]);
    expect(component.courseToDelete?.id).toBe("CRS-002");

    component.deleteCourse();
    expect(courseServiceMock.delete).toHaveBeenCalledWith("CRS-002");
    expect(component.courseToDelete).toBeNull();
  });

  it("validates curriculum file formats allowing PDF, DOC, DOCX, PPT, PPTX", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    // Valid PPT file
    const validFile = new File(["dummy"], "syllabus.pptx", { type: "application/vnd.ms-powerpoint" });
    const event = { target: { files: [validFile] } } as any;

    component.onCurriculumSelected(event);
    expect(component.uploadError).toBe("");
    expect(component.curriculumFile?.name).toBe("syllabus.pptx");

    // Invalid format (e.g. .exe or .zip)
    const invalidFile = new File(["dummy"], "file.zip", { type: "application/zip" });
    const invalidEvent = { target: { files: [invalidFile], value: "file.zip" } } as any;

    component.onCurriculumSelected(invalidEvent);
    expect(component.uploadError).toContain("Only PDF, DOC, DOCX, and PPT/PPTX files are allowed");
    expect(component.curriculumFile).toBeNull();
  });

  it("allows downloading curriculum file", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    component.downloadCurriculum(sampleCourses[0]);
    expect(courseServiceMock.downloadCurriculum).toHaveBeenCalledWith("CRS-001");
  });

  it("contains the 16 standard course titles in suggestions and allows adding custom duration tracks", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    expect(component.standardCourseTitles.length).toBe(16);
    expect(component.standardCourseTitles).toContain("Full Stack Development with Java & Angular");
    expect(component.standardCourseTitles).toContain("Cloud Engineering with AWS & Azure");
    expect(component.standardCourseTitles).toContain("DevOps Engineering");
    expect(component.standardCourseTitles).toContain("Python for Web Development & Automation");
    expect(component.standardCourseTitles).toContain("C# & .NET Development");
    expect(component.standardCourseTitles).toContain("IoT with Embedded C");
    expect(component.standardCourseTitles).toContain("Digital Marketing");
    expect(component.standardCourseTitles).toContain("AI with Machine Learning");
    expect(component.standardCourseTitles).toContain("Python with Data Science");
    expect(component.standardCourseTitles).toContain("Java with Automation Testing");
    expect(component.standardCourseTitles).toContain("Java with ReactJS");
    expect(component.standardCourseTitles).toContain("Hardware and Networking");
    expect(component.standardCourseTitles).toContain("IoT (Internet of Things)");
    expect(component.standardCourseTitles).toContain("Robotics");
    expect(component.standardCourseTitles).toContain("Japanese Spoken Course");
    expect(component.standardCourseTitles).toContain("AI and Data Science");

    component.openAddCourseModal();
    expect(component.courseName).toBe("");
    expect(component.modalCurriculumFile).toBeNull();
    expect(component.modalTracks.length).toBe(4);
    expect(component.modalTracks[0].duration).toBe("15 Days");

    // Test adding custom duration track inside the box separately
    component.addModalTrack("45 Days", 18000);
    expect(component.modalTracks.length).toBe(5);
    expect(component.modalTracks[4].duration).toBe("45 Days");
    expect(component.modalTracks[4].fees).toBe(18000);
  });

  it("allows uploading curriculum document directly from Add Course pop up", () => {
    component = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    component.ngOnInit();

    component.openAddCourseModal();
    component.courseName = "AI with Machine Learning";

    const currFile = new File(["curriculum"], "ai-ml.pdf", { type: "application/pdf" });
    component.onModalCurriculumSelected({ target: { files: [currFile] } } as any);
    expect(component.modalCurriculumFile?.name).toBe("ai-ml.pdf");
    expect(component.modalCurriculumError).toBe("");

    component.saveCourse();

    expect(courseServiceMock.create).toHaveBeenCalledOnce();
    expect(courseServiceMock.uploadCurriculum).toHaveBeenCalledWith("CRS-003", currFile);
    expect(component.showCourseModal).toBe(false);
  });

  it("enforces that only Manager can set or edit the course fee structure while HR is read-only", () => {
    // 1. Manager sets/edits fee
    const managerComp = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    managerComp.ngOnInit();
    managerComp.openEditCourseModal(sampleCourses[0]);
    expect(managerComp.showCourseModal).toBe(true);
    expect(managerComp.courseFees).toBe(30000);

    managerComp.courseFees = 38000;
    managerComp.saveCourse();
    expect(courseServiceMock.update).toHaveBeenCalledWith(
      "CRS-001",
      expect.objectContaining({ fees: 38000 }),
    );

    // 2. HR can view fee and specifications but cannot open edit/add modal
    const hrComp = new CourseManagementComponent(courseServiceMock, authServiceHrMock);
    hrComp.ngOnInit();
    expect(hrComp.isManager).toBe(false);
    expect(hrComp.isHr).toBe(true);

    hrComp.openEditCourseModal(sampleCourses[0]);
    expect(hrComp.showCourseModal).toBe(false);

    hrComp.openViewDetails(sampleCourses[0]);
    expect(hrComp.viewCourse?.fees).toBe(30000);
  });

  it("supports Multi-Duration Tracks (Option A): switching tabs and updating fees per duration", () => {
    const managerComp = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    managerComp.ngOnInit();

    managerComp.openTracksModal(sampleCourses[0]);
    expect(managerComp.showTracksModal).toBe(true);
    expect(managerComp.activeTrackDuration).toBe("15 Days");
    expect(managerComp.trackFees).toBe(8000);

    // Switch to 6 Months tab
    managerComp.selectTrackDuration("6 Months");
    expect(managerComp.activeTrackDuration).toBe("6 Months");
    expect(managerComp.trackFees).toBe(45000);

    // Update 6 Months fee to 48000
    managerComp.trackFees = 48000;
    managerComp.saveTrackFee();
    expect(courseServiceMock.updateTrackFee).toHaveBeenCalledWith("CRS-001", "6 Months", 48000);
    expect(managerComp.successMessage).toContain("updated to ₹48000");
  });

  it("supports uploading and downloading curriculum document for a specific duration track", () => {
    const managerComp = new CourseManagementComponent(courseServiceMock, authServiceManagerMock);
    managerComp.ngOnInit();

    managerComp.openTracksModal(sampleCourses[0]);
    managerComp.selectTrackDuration("15 Days");

    const trackFile = new File(["syllabus-15d"], "java-15d.pdf", { type: "application/pdf" });
    managerComp.onTrackCurriculumSelected({ target: { files: [trackFile] } } as any);
    expect(managerComp.trackCurriculumFile?.name).toBe("java-15d.pdf");

    managerComp.submitTrackCurriculum();
    expect(courseServiceMock.uploadTrackCurriculum).toHaveBeenCalledWith("CRS-001", "15 Days", trackFile);

    // Download track curriculum
    const createObjectUrlSpy = vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock-track-url");
    const revokeObjectUrlSpy = vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => {});

    managerComp.downloadTrackCurriculum(sampleCourses[0], "15 Days");
    expect(courseServiceMock.downloadTrackCurriculum).toHaveBeenCalledWith("CRS-001", "15 Days");
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:mock-track-url");
  });
});
