import { ChangeDetectorRef, Component, OnInit, Optional, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Course, CourseTrack } from "../../core/models/course.model";
import { CourseService } from "../../core/services/course.service";
import { AuthService } from "../../core/services/auth.service";

export const STANDARD_COURSES = [
  "Full Stack Development with Java & Angular",
  "Cloud Engineering with AWS & Azure",
  "DevOps Engineering",
  "Python for Web Development & Automation",
  "C# & .NET Development",
  "IoT with Embedded C",
  "Digital Marketing",
  "AI with Machine Learning",
  "Python with Data Science",
  "Java with Automation Testing",
  "Java with ReactJS",
  "Hardware and Networking",
  "IoT (Internet of Things)",
  "Robotics",
  "Japanese Spoken Course",
  "AI and Data Science",
] as const;

export const COURSE_CATEGORY_MAP: Record<string, string> = {
  "Full Stack Development with Java & Angular": "Full Stack & Web",
  "Cloud Engineering with AWS & Azure": "Cloud & Infrastructure",
  "DevOps Engineering": "Cloud & Infrastructure",
  "Python for Web Development & Automation": "Full Stack & Web",
  "C# & .NET Development": "Software Development",
  "IoT with Embedded C": "Embedded & Hardware",
  "Digital Marketing": "Marketing & Business",
  "AI with Machine Learning": "Data & AI",
  "Python with Data Science": "Data & AI",
  "Java with Automation Testing": "Testing & QA",
  "Java with ReactJS": "Full Stack & Web",
  "Hardware and Networking": "Hardware & Systems",
  "IoT (Internet of Things)": "Embedded & Hardware",
  "Robotics": "Robotics & Automation",
  "Japanese Spoken Course": "Language & Communication",
  "AI and Data Science": "Data & AI",
};

@Component({
  selector: "app-course-management",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./course-management.html",
  styleUrl: "./course-management.css",
})
export class CourseManagementComponent implements OnInit {
  private readonly courseService: CourseService;
  private readonly authService?: AuthService;
  private readonly cdr: ChangeDetectorRef;

  readonly standardCourseTitles = STANDARD_COURSES;

  isStandardCourse(title: string): boolean {
    return (this.standardCourseTitles as readonly string[]).includes(title);
  }

  courses: Course[] = [];
  filteredCourses: Course[] = [];
  categories: string[] = [];

  loading = true;
  errorMessage = "";
  successMessage = "";

  searchQuery = "";
  categoryFilter = "ALL";
  curriculumFilter = "ALL";
  statusFilter = "ALL";

  get isManager(): boolean {
    return this.authService?.role === "MANAGER";
  }

  get isHr(): boolean {
    return this.authService?.role === "HR";
  }

  // Course Add/Edit Modal
  showCourseModal = false;
  editingCourseId: string | null = null;
  courseName = "";
  courseCode = "";
  courseCategory = "Full Stack & Web";
  courseDuration = "3 Months";
  courseMode = "Online / Offline";
  courseFees = 0;
  courseDescription = "";
  courseKeyTopics = "";
  courseStatus: "ACTIVE" | "INACTIVE" = "ACTIVE";
  savingCourse = false;
  courseFormError = "";
  modalCurriculumFile: File | null = null;
  modalCurriculumError = "";

  // Delete Confirmation Modal
  courseToDelete: Course | null = null;
  deletingCourse = false;

  // Curriculum Upload Modal
  showUploadModal = false;
  uploadCourse: Course | null = null;
  curriculumFile: File | null = null;
  uploadError = "";
  uploadingCurriculum = false;

  // HR / Manager View Details Modal
  viewCourse: Course | null = null;

  // Duration Tracks Management Modal (Option A)
  showTracksModal = false;
  selectedTrackCourse: Course | null = null;
  activeTrackDuration: string = "15 Days";
  trackFees = 0;
  savingTrackFee = false;
  trackCurriculumFile: File | null = null;
  trackCurriculumError = "";
  uploadingTrackCurriculum = false;

  // Tracks inside Add/Edit Course Modal
  modalTracks: Array<{ duration: string; fees: number }> = [];

  readonly standardDurations = ["15 Days", "1 Month", "3 Months", "6 Months"] as const;
  readonly durationOptions = ["15 Days", "1 Month", "3 Months", "6 Months", "1 Year"] as const;
  readonly modeOptions = ["Online / Offline", "Online Interactive", "Classroom / Lab"] as const;
  readonly allowedExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx"] as const;

  constructor(
    @Optional() courseService?: CourseService,
    @Optional() authService?: AuthService,
    @Optional() cdr?: ChangeDetectorRef,
  ) {
    this.authService = authService ?? this.safeInject(AuthService);
    this.courseService = courseService ?? this.safeInject(CourseService) ?? ({} as CourseService);
    this.cdr = cdr ?? this.safeInject(ChangeDetectorRef) ?? ({ markForCheck: () => {}, detectChanges: () => {} } as ChangeDetectorRef);
  }

  private safeInject<T>(token: any): T | undefined {
    try {
      return inject(token);
    } catch {
      return undefined;
    }
  }

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    this.loading = true;
    this.errorMessage = "";
    this.cdr.markForCheck();

    this.courseService.list().subscribe({
      next: (courses) => {
        this.courses = courses || [];
        this.extractCategories();
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.errorMessage = err?.message || "Failed to load courses.";
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private extractCategories(): void {
    const set = new Set<string>();
    for (const c of this.courses) {
      if (c.category) set.add(c.category);
    }
    this.categories = Array.from(set).sort();
  }

  applyFilter(): void {
    let list = [...this.courses];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.category && c.category.toLowerCase().includes(q)) ||
          (c.description && c.description.toLowerCase().includes(q)),
      );
    }

    if (this.categoryFilter !== "ALL") {
      list = list.filter((c) => c.category === this.categoryFilter);
    }

    if (this.curriculumFilter === "WITH_CURRICULUM") {
      list = list.filter((c) => Boolean(c.curriculumFileId));
    } else if (this.curriculumFilter === "WITHOUT_CURRICULUM") {
      list = list.filter((c) => !c.curriculumFileId);
    }

    if (this.statusFilter !== "ALL") {
      list = list.filter((c) => c.status === this.statusFilter);
    }

    this.filteredCourses = list;
    this.cdr.markForCheck();
  }

  // --- Manager Course Actions ---

  getDefaultModalTracks(baseFee: number = 30000): Array<{ duration: string; fees: number }> {
    const fee = baseFee > 0 ? baseFee : 30000;
    return [
      { duration: "15 Days", fees: Math.round((fee * 0.35) / 500) * 500 || 8000 },
      { duration: "1 Month", fees: Math.round((fee * 0.6) / 500) * 500 || 15000 },
      { duration: "3 Months", fees: fee },
      { duration: "6 Months", fees: Math.round((fee * 1.5) / 500) * 500 || 45000 },
    ];
  }

  addModalTrack(customDuration?: string, customFee?: number): void {
    const name = (customDuration || `Track ${this.modalTracks.length + 1}`).trim();
    const fee = customFee !== undefined ? customFee : 10000;
    this.modalTracks.push({
      duration: name,
      fees: fee,
    });
    this.cdr.markForCheck();
  }

  removeModalTrack(index: number): void {
    if (this.modalTracks.length <= 1) return;
    this.modalTracks.splice(index, 1);
    this.cdr.markForCheck();
  }

  openAddCourseModal(): void {
    if (!this.isManager) return;
    this.editingCourseId = null;
    this.courseName = "";
    this.courseCode = "";
    this.courseCategory = "General IT";
    this.courseDuration = "15 Days to 6 Months";
    this.courseMode = "Online / Offline";
    this.courseFees = 30000;
    this.courseDescription = "";
    this.courseKeyTopics = "";
    this.courseStatus = "ACTIVE";
    this.courseFormError = "";
    this.modalCurriculumFile = null;
    this.modalCurriculumError = "";
    this.modalTracks = this.getDefaultModalTracks(30000);
    this.showCourseModal = true;
    this.cdr.markForCheck();
  }

  openEditCourseModal(course: Course): void {
    if (!this.isManager) return;
    this.editingCourseId = course.id;
    this.courseName = course.name;
    this.courseCode = course.code || "";
    this.courseCategory = course.category || COURSE_CATEGORY_MAP[course.name] || "General IT";
    this.courseDuration = course.duration || "15 Days to 6 Months";
    this.courseMode = course.mode || "Online / Offline";
    this.courseFees = course.fees || 0;
    this.courseDescription = course.description || "";
    this.courseKeyTopics = (course.keyTopics || []).join(", ");
    this.courseStatus = course.status || "ACTIVE";
    this.courseFormError = "";
    this.modalCurriculumFile = null;
    this.modalCurriculumError = "";
    if (course.tracks && course.tracks.length > 0) {
      this.modalTracks = course.tracks.map((t) => ({ duration: t.duration, fees: t.fees }));
    } else {
      this.modalTracks = this.getDefaultModalTracks(course.fees || 30000);
    }
    this.showCourseModal = true;
    this.cdr.markForCheck();
  }

  onCourseNameChange(newTitle: string): void {
    this.courseName = newTitle;
    this.courseCategory = COURSE_CATEGORY_MAP[newTitle] || "General IT";
    this.cdr.markForCheck();
  }

  onModalCurriculumSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.modalCurriculumError = "";
    if (!input.files || input.files.length === 0) {
      this.modalCurriculumFile = null;
      return;
    }

    const file = input.files[0];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
      this.modalCurriculumError = "Only PDF, PPT, PPTX, DOC, and DOCX files are allowed.";
      input.value = "";
      this.modalCurriculumFile = null;
      this.cdr.markForCheck();
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      this.modalCurriculumError = "Curriculum file size must not exceed 15 MB.";
      input.value = "";
      this.modalCurriculumFile = null;
      this.cdr.markForCheck();
      return;
    }

    this.modalCurriculumFile = file;
    this.modalCurriculumError = "";
    this.cdr.markForCheck();
  }

  clearModalCurriculum(input?: HTMLInputElement): void {
    this.modalCurriculumFile = null;
    this.modalCurriculumError = "";
    if (input) input.value = "";
    this.cdr.markForCheck();
  }

  closeCourseModal(): void {
    this.showCourseModal = false;
    this.courseFormError = "";
    this.modalCurriculumFile = null;
    this.modalCurriculumError = "";
    this.cdr.markForCheck();
  }

  saveCourse(): void {
    if (!this.isManager) return;
    if (!this.courseName.trim()) {
      this.courseFormError = "Course Title is required.";
      this.cdr.markForCheck();
      return;
    }

    this.savingCourse = true;
    this.courseFormError = "";
    this.cdr.markForCheck();

    const topics = this.courseKeyTopics
      ? this.courseKeyTopics.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const category = this.courseCategory || COURSE_CATEGORY_MAP[this.courseName.trim()] || "General IT";

    const cleanTracks = this.modalTracks
      .filter((t) => t.duration && t.duration.trim())
      .map((t) => ({ duration: t.duration.trim(), fees: Number(t.fees) || 0 }));

    const resolvedFee = Number(this.courseFees) || 0;
    const track3M = cleanTracks.find((t) => t.duration.toLowerCase() === "3 months");
    if (track3M && resolvedFee > 0 && track3M.fees !== resolvedFee) {
      track3M.fees = resolvedFee;
    }

    const payload: Partial<Course> = {
      name: this.courseName.trim(),
      code: this.courseCode.trim(),
      category: category.trim(),
      duration: this.courseDuration || "15 Days to 6 Months",
      mode: this.courseMode,
      fees: resolvedFee || (track3M ? track3M.fees : (cleanTracks[0]?.fees || 0)),
      description: this.courseDescription.trim(),
      keyTopics: topics,
      status: this.courseStatus,
      tracks: cleanTracks.length > 0 ? (cleanTracks as any) : undefined,
    };

    if (this.editingCourseId) {
      this.courseService.update(this.editingCourseId, payload).subscribe({
        next: (updated) => {
          if (this.modalCurriculumFile) {
            this.courseService.uploadCurriculum(updated.id, this.modalCurriculumFile).subscribe({
              next: (withCurriculum) => {
                this.savingCourse = false;
                this.showCourseModal = false;
                this.courses = this.courses.map((c) => (c.id === withCurriculum.id ? withCurriculum : c));
                this.extractCategories();
                this.applyFilter();
                this.successMessage = `Course '${withCurriculum.name}' and curriculum updated successfully!`;
                this.modalCurriculumFile = null;
                this.cdr.markForCheck();
              },
              error: (uploadErr) => {
                this.savingCourse = false;
                this.showCourseModal = false;
                this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
                this.extractCategories();
                this.applyFilter();
                this.successMessage = `Course '${updated.name}' updated, but curriculum upload failed: ${uploadErr?.message || "upload failed"}.`;
                this.modalCurriculumFile = null;
                this.cdr.markForCheck();
              },
            });
          } else {
            this.savingCourse = false;
            this.showCourseModal = false;
            this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
            this.extractCategories();
            this.applyFilter();
            this.successMessage = `Course '${updated.name}' updated successfully!`;
            this.cdr.markForCheck();
          }
        },
        error: (err: Error) => {
          this.savingCourse = false;
          this.courseFormError = err?.message || "Failed to update course.";
          this.cdr.markForCheck();
        },
      });
    } else {
      this.courseService.create(payload).subscribe({
        next: (created) => {
          if (this.modalCurriculumFile) {
            this.courseService.uploadCurriculum(created.id, this.modalCurriculumFile).subscribe({
              next: (withCurriculum) => {
                this.savingCourse = false;
                this.showCourseModal = false;
                this.courses = [withCurriculum, ...this.courses.filter((c) => c.id !== withCurriculum.id)];
                this.extractCategories();
                this.applyFilter();
                this.successMessage = `Course '${withCurriculum.name}' created with curriculum successfully!`;
                this.modalCurriculumFile = null;
                this.cdr.markForCheck();
              },
              error: (uploadErr) => {
                this.savingCourse = false;
                this.showCourseModal = false;
                this.courses = [created, ...this.courses];
                this.extractCategories();
                this.applyFilter();
                this.successMessage = `Course '${created.name}' created, but curriculum upload failed: ${uploadErr?.message || "upload failed"}.`;
                this.modalCurriculumFile = null;
                this.cdr.markForCheck();
              },
            });
          } else {
            this.savingCourse = false;
            this.showCourseModal = false;
            this.courses = [created, ...this.courses];
            this.extractCategories();
            this.applyFilter();
            this.successMessage = `Course '${created.name}' created successfully!`;
            this.cdr.markForCheck();
          }
        },
        error: (err: Error) => {
          this.savingCourse = false;
          this.courseFormError = err?.message || "Failed to create course.";
          this.cdr.markForCheck();
        },
      });
    }
  }

  confirmDelete(course: Course): void {
    if (!this.isManager) return;
    this.courseToDelete = course;
    this.cdr.markForCheck();
  }

  cancelDelete(): void {
    this.courseToDelete = null;
    this.cdr.markForCheck();
  }

  deleteCourse(): void {
    if (!this.isManager || !this.courseToDelete) return;
    const target = this.courseToDelete;
    this.deletingCourse = true;
    this.cdr.markForCheck();

    this.courseService.delete(target.id).subscribe({
      next: () => {
        this.deletingCourse = false;
        this.courses = this.courses.filter((c) => c.id !== target.id);
        this.courseToDelete = null;
        this.extractCategories();
        this.applyFilter();
        this.successMessage = `Course '${target.name}' deleted successfully.`;
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.deletingCourse = false;
        this.errorMessage = err?.message || "Failed to delete course.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Curriculum Upload (Manager) & Download (Manager & HR) ---

  openUploadCurriculum(course: Course): void {
    if (!this.isManager) return;
    this.uploadCourse = course;
    this.curriculumFile = null;
    this.uploadError = "";
    this.showUploadModal = true;
    this.cdr.markForCheck();
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.uploadCourse = null;
    this.curriculumFile = null;
    this.uploadError = "";
    this.cdr.markForCheck();
  }

  onCurriculumSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadError = "";
    if (!input.files || input.files.length === 0) {
      this.curriculumFile = null;
      return;
    }

    const file = input.files[0];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
      this.uploadError = "Only PDF, DOC, DOCX, and PPT/PPTX files are allowed.";
      input.value = "";
      this.curriculumFile = null;
      this.cdr.markForCheck();
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      this.uploadError = "Curriculum file size must not exceed 15 MB.";
      input.value = "";
      this.curriculumFile = null;
      this.cdr.markForCheck();
      return;
    }

    this.curriculumFile = file;
    this.uploadError = "";
    this.cdr.markForCheck();
  }

  submitCurriculum(): void {
    if (!this.isManager || !this.uploadCourse || !this.curriculumFile) return;

    this.uploadingCurriculum = true;
    this.uploadError = "";
    this.cdr.markForCheck();

    this.courseService.uploadCurriculum(this.uploadCourse.id, this.curriculumFile).subscribe({
      next: (updated) => {
        this.uploadingCurriculum = false;
        this.showUploadModal = false;
        this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
        this.applyFilter();
        this.successMessage = `Curriculum '${updated.curriculumFileName}' uploaded for '${updated.name}'!`;
        this.curriculumFile = null;
        this.uploadCourse = null;
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.uploadingCurriculum = false;
        this.uploadError = err?.message || "Failed to upload curriculum.";
        this.cdr.markForCheck();
      },
    });
  }

  removeCurriculum(course: Course): void {
    if (!this.isManager) return;
    if (!confirm(`Are you sure you want to remove the curriculum document for '${course.name}'?`)) return;

    this.courseService.deleteCurriculum(course.id).subscribe({
      next: (updated) => {
        this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
        this.applyFilter();
        this.successMessage = `Curriculum document removed for '${course.name}'.`;
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        this.errorMessage = err?.message || "Failed to remove curriculum.";
        this.cdr.markForCheck();
      },
    });
  }

  downloadCurriculum(course: Course): void {
    if (!course.curriculumFileId) return;

    this.courseService.downloadCurriculum(course.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = course.curriculumFileName
          ? course.curriculumFileName.slice(course.curriculumFileName.lastIndexOf("."))
          : ".pdf";
        const safeName = course.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        a.download = `TVK-${safeName}-Curriculum${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err: Error) => {
        this.errorMessage = err?.message || "Failed to download curriculum document.";
        this.cdr.markForCheck();
      },
    });
  }

  // --- Duration Track Operations (Option A) ---

  openTracksModal(course: Course): void {
    this.selectedTrackCourse = course;
    this.showTracksModal = true;
    this.trackCurriculumFile = null;
    this.trackCurriculumError = "";
    this.selectTrackDuration("15 Days");
    this.cdr.markForCheck();
  }

  closeTracksModal(): void {
    this.showTracksModal = false;
    this.selectedTrackCourse = null;
    this.trackCurriculumFile = null;
    this.trackCurriculumError = "";
    this.cdr.markForCheck();
  }

  getCourseDurations(course?: Course | null): string[] {
    if (!course || !course.tracks || course.tracks.length === 0) {
      return [...this.standardDurations];
    }
    const list: string[] = [];
    for (const t of course.tracks) {
      if (!list.includes(t.duration)) list.push(t.duration);
    }
    for (const std of this.standardDurations) {
      if (!list.some((d) => d.toLowerCase() === std.toLowerCase())) list.push(std);
    }
    return list;
  }

  selectTrackDuration(duration: string): void {
    this.activeTrackDuration = duration;
    this.trackCurriculumFile = null;
    this.trackCurriculumError = "";
    const track = this.getActiveTrack();
    this.trackFees = track?.fees || 0;
    this.cdr.markForCheck();
  }

  getActiveTrack(): CourseTrack | undefined {
    if (!this.selectedTrackCourse) return undefined;
    return (this.selectedTrackCourse.tracks || []).find(
      (t) => t.duration.toLowerCase() === this.activeTrackDuration.toLowerCase(),
    );
  }

  saveTrackFee(): void {
    if (!this.isManager || !this.selectedTrackCourse) return;
    this.savingTrackFee = true;
    this.cdr.markForCheck();

    this.courseService
      .updateTrackFee(this.selectedTrackCourse.id, this.activeTrackDuration, Number(this.trackFees) || 0)
      .subscribe({
        next: (updated) => {
          this.savingTrackFee = false;
          this.selectedTrackCourse = updated;
          this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
          this.applyFilter();
          this.successMessage = `Fee for '${updated.name}' (${this.activeTrackDuration}) updated to ₹${Number(this.trackFees) || 0}!`;
          this.cdr.markForCheck();
        },
        error: (err: Error) => {
          this.savingTrackFee = false;
          this.trackCurriculumError = err?.message || "Failed to update track fee.";
          this.cdr.markForCheck();
        },
      });
  }

  onTrackCurriculumSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.trackCurriculumError = "";
    if (!input.files || input.files.length === 0) {
      this.trackCurriculumFile = null;
      return;
    }

    const file = input.files[0];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".doc", ".docx", ".ppt", ".pptx"].includes(ext)) {
      this.trackCurriculumError = "Only PDF, PPT, PPTX, DOC, and DOCX files are allowed.";
      input.value = "";
      this.trackCurriculumFile = null;
      this.cdr.markForCheck();
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      this.trackCurriculumError = "Curriculum file size must not exceed 15 MB.";
      input.value = "";
      this.trackCurriculumFile = null;
      this.cdr.markForCheck();
      return;
    }

    this.trackCurriculumFile = file;
    this.trackCurriculumError = "";
    this.cdr.markForCheck();
  }

  submitTrackCurriculum(): void {
    if (!this.isManager || !this.selectedTrackCourse || !this.trackCurriculumFile) return;

    this.uploadingTrackCurriculum = true;
    this.trackCurriculumError = "";
    this.cdr.markForCheck();

    this.courseService
      .uploadTrackCurriculum(this.selectedTrackCourse.id, this.activeTrackDuration, this.trackCurriculumFile)
      .subscribe({
        next: (updated) => {
          this.uploadingTrackCurriculum = false;
          this.selectedTrackCourse = updated;
          this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
          this.applyFilter();
          this.trackCurriculumFile = null;
          this.successMessage = `Curriculum for '${updated.name}' (${this.activeTrackDuration}) uploaded successfully!`;
          this.cdr.markForCheck();
        },
        error: (err: Error) => {
          this.uploadingTrackCurriculum = false;
          this.trackCurriculumError = err?.message || "Failed to upload track curriculum.";
          this.cdr.markForCheck();
        },
      });
  }

  deleteTrackCurriculum(): void {
    if (!this.isManager || !this.selectedTrackCourse) return;
    if (!confirm(`Are you sure you want to remove the curriculum for '${this.selectedTrackCourse.name}' (${this.activeTrackDuration})?`)) return;

    this.courseService
      .deleteTrackCurriculum(this.selectedTrackCourse.id, this.activeTrackDuration)
      .subscribe({
        next: (updated) => {
          this.selectedTrackCourse = updated;
          this.courses = this.courses.map((c) => (c.id === updated.id ? updated : c));
          this.applyFilter();
          this.successMessage = `Curriculum for '${updated.name}' (${this.activeTrackDuration}) removed.`;
          this.cdr.markForCheck();
        },
        error: (err: Error) => {
          this.trackCurriculumError = err?.message || "Failed to remove curriculum.";
          this.cdr.markForCheck();
        },
      });
  }

  downloadTrackCurriculum(course: Course, duration: string): void {
    const track = (course.tracks || []).find((t) => t.duration.toLowerCase() === duration.toLowerCase());
    if (!track?.curriculumFileId) return;

    this.courseService.downloadTrackCurriculum(course.id, duration).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = track.curriculumFileName
          ? track.curriculumFileName.slice(track.curriculumFileName.lastIndexOf("."))
          : ".pdf";
        const safeName = course.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        const safeDur = duration.replace(/[^a-zA-Z0-9_-]/g, "_");
        a.download = `TVK-${safeName}-${safeDur}-Curriculum${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err: Error) => {
        this.errorMessage = err?.message || "Failed to download track curriculum.";
        this.cdr.markForCheck();
      },
    });
  }

  getTrackByDuration(course: Course, duration: string): CourseTrack | undefined {
    return (course.tracks || []).find((t) => t.duration.toLowerCase() === duration.toLowerCase());
  }

  // --- View Course Details (Audit & Verification for HR and Manager) ---

  openViewDetails(course: Course): void {
    this.viewCourse = course;
    this.cdr.markForCheck();
  }

  closeViewDetails(): void {
    this.viewCourse = null;
    this.cdr.markForCheck();
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getCurriculumBadgeClass(type?: string): string {
    const t = (type || "").toUpperCase();
    if (t.includes("PDF")) return "badge-pdf";
    if (t.includes("DOC")) return "badge-doc";
    if (t.includes("PPT")) return "badge-ppt";
    return "badge-generic";
  }
}
