import { randomUUID } from "node:crypto";
import { FilterQuery } from "mongoose";
import { CourseDocument, CourseModel, CourseRecord, CourseTrackRecord } from "../models/course.model";
import { CurriculumFileModel, CurriculumFileRecord } from "../models/curriculum-file.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";
import { courseCreateSchema, courseQuerySchema, courseUpdateSchema } from "../validators/course.validators";

export const STANDARD_TRACK_DURATIONS = ["15 Days", "1 Month", "3 Months", "6 Months"] as const;

export function normalizeCourseTitle(rawTitle?: string | null): string {
  if (!rawTitle) return "";
  let clean = rawTitle.trim();
  clean = clean.replace(/^(Training|Internship|Placement|Placements|Projects|Project|Job)\s*[-:–—]\s*/i, "").trim();
  return clean;
}

export function buildDefaultTracks(baseFee: number): CourseTrackRecord[] {
  const fee = baseFee > 0 ? baseFee : 30000;
  return [
    { duration: "15 Days", fees: Math.round((fee * 0.35) / 500) * 500 || 8000 },
    { duration: "1 Month", fees: Math.round((fee * 0.6) / 500) * 500 || 15000 },
    { duration: "3 Months", fees: fee },
    { duration: "6 Months", fees: Math.round((fee * 1.5) / 500) * 500 || 45000 },
  ];
}

export function ensureCourseTracks(course: CourseDocument): CourseTrackRecord[] {
  let tracks = course.tracks || [];
  const defaultTracks = buildDefaultTracks(course.fees);
  let changed = false;

  for (const def of defaultTracks) {
    const exists = tracks.some((t) => t.duration.toLowerCase() === def.duration.toLowerCase());
    if (!exists) {
      tracks.push(def);
      changed = true;
    }
  }

  if (course.curriculumFileId) {
    const track3M = tracks.find((t) => t.duration.toLowerCase() === "3 months");
    if (track3M && !track3M.curriculumFileId) {
      track3M.curriculumFileId = course.curriculumFileId;
      track3M.curriculumFileName = course.curriculumFileName;
      track3M.curriculumFileType = course.curriculumFileType;
      track3M.curriculumFileSize = course.curriculumFileSize;
      track3M.curriculumUploadedAt = course.curriculumUploadedAt;
      changed = true;
    }
  }

  if (changed) {
    course.tracks = tracks;
  }
  return tracks;
}

const SEED_COURSES: Array<Partial<CourseRecord>> = [
  {
    name: "Full Stack Development with Java & Angular",
    code: "TVK-FSJ-01",
    category: "Full Stack & Web",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 30000,
    description: "End-to-end full stack development focusing on Java, Spring Boot microservices, TypeScript, Angular frontend, and SQL databases.",
    keyTopics: ["Java 17+", "Spring Boot", "REST APIs", "Angular 18+", "TypeScript", "PostgreSQL / MySQL"],
  },
  {
    name: "Cloud Engineering with AWS & Azure",
    code: "TVK-CLD-02",
    category: "Cloud & Infrastructure",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 35000,
    description: "Hands-on cloud engineering covering AWS and Microsoft Azure architecture, serverless, compute, networking, and security.",
    keyTopics: ["AWS EC2/S3/Lambda", "Azure Virtual Machines", "IAM & Cloud Security", "VPC Networking", "Terraform Basics"],
  },
  {
    name: "DevOps Engineering",
    code: "TVK-DVO-03",
    category: "Cloud & Infrastructure",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 35000,
    description: "Industry standard DevOps practices: CI/CD pipelines, containerization with Docker, orchestration with Kubernetes, and infrastructure as code.",
    keyTopics: ["Docker", "Kubernetes", "Jenkins", "GitHub Actions", "Terraform", "Linux & Bash"],
  },
  {
    name: "Python for Web Development & Automation",
    code: "TVK-PYW-04",
    category: "Full Stack & Web",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 28000,
    description: "Comprehensive Python programming covering Django/FastAPI web frameworks, automation scripts, and database integrations.",
    keyTopics: ["Python 3", "Django", "FastAPI", "Web Scraping", "Automation Scripting", "REST APIs"],
  },
  {
    name: "C# & .NET Development",
    code: "TVK-NET-05",
    category: "Software Development",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 28000,
    description: "Enterprise .NET Core development using C#, ASP.NET Core Web APIs, Entity Framework Core, and SQL Server.",
    keyTopics: ["C# Language", ".NET Core 8", "ASP.NET Core Web API", "Entity Framework", "SQL Server"],
  },
  {
    name: "IoT with Embedded C",
    code: "TVK-IOT-06",
    category: "Embedded & Hardware",
    duration: "3 Months",
    mode: "Classroom / Lab",
    fees: 32000,
    description: "Internet of Things fundamentals combining Embedded C, microcontrollers (ESP32/Arduino), sensors, and cloud communication.",
    keyTopics: ["Embedded C", "ESP32 / STM32", "Sensor Interfacing", "MQTT & HTTP Protocols", "IoT Dashboards"],
  },
  {
    name: "Digital Marketing",
    code: "TVK-MKT-07",
    category: "Marketing & Business",
    duration: "1 Month",
    mode: "Online / Offline",
    fees: 18000,
    description: "Practical digital marketing covering Search Engine Optimization (SEO), Google Ads, social media strategy, and content marketing.",
    keyTopics: ["SEO Strategy", "Google Ads / PPC", "Meta Ads", "Email Marketing", "Google Analytics 4"],
  },
  {
    name: "AI with Machine Learning",
    code: "TVK-AIM-08",
    category: "Data & AI",
    duration: "6 Months",
    mode: "Online / Offline",
    fees: 45000,
    description: "Deep dive into Artificial Intelligence and Machine Learning algorithms, predictive modeling, Scikit-Learn, and neural networks.",
    keyTopics: ["Supervised & Unsupervised ML", "Scikit-Learn", "Neural Networks", "TensorFlow / PyTorch", "Model Deployment"],
  },
  {
    name: "Python with Data Science",
    code: "TVK-PDS-09",
    category: "Data & AI",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 32000,
    description: "Data analysis and scientific computing with Python, Pandas, NumPy, statistical analysis, and interactive visualization tools.",
    keyTopics: ["NumPy", "Pandas", "Matplotlib / Seaborn", "Statistical Analysis", "Data Cleaning & EDA"],
  },
  {
    name: "Java with Automation Testing",
    code: "TVK-JAT-10",
    category: "Quality Assurance",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 26000,
    description: "Software testing automation using Java, Selenium WebDriver, TestNG framework, Cucumber BDD, and CI/CD integration.",
    keyTopics: ["Core Java", "Selenium WebDriver", "TestNG", "Cucumber BDD", "Page Object Model", "Git & Jenkins"],
  },
  {
    name: "Java with ReactJS",
    code: "TVK-JRC-11",
    category: "Full Stack & Web",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 30000,
    description: "Modern enterprise stack uniting Java Spring Boot backends with fast, component-driven ReactJS frontends.",
    keyTopics: ["Java Spring Boot", "REST APIs", "React 18+", "React Hooks & Redux", "Tailwind CSS", "JWT Auth"],
  },
  {
    name: "Hardware and Networking",
    code: "TVK-HWN-12",
    category: "Embedded & Hardware",
    duration: "3 Months",
    mode: "Classroom / Lab",
    fees: 22000,
    description: "Computer hardware troubleshooting, operating system deployment, IP routing, switching, LAN/WAN, and network security basics.",
    keyTopics: ["PC Assembly & Hardware", "TCP/IP & OSI Model", "Routers & Switches", "DHCP / DNS", "Network Troubleshooting"],
  },
  {
    name: "IoT (Internet of Things)",
    code: "TVK-IOT-13",
    category: "Embedded & Hardware",
    duration: "3 Months",
    mode: "Online / Offline",
    fees: 30000,
    description: "Architecture and implementation of smart IoT ecosystems: edge computing, wireless sensors, cloud telemetry, and automation.",
    keyTopics: ["IoT Architecture", "Wireless Sensors", "Node-RED", "Cloud Telemetry", "Home & Industrial Automation"],
  },
  {
    name: "Robotics",
    code: "TVK-ROB-14",
    category: "Embedded & Hardware",
    duration: "3 Months",
    mode: "Classroom / Lab",
    fees: 35000,
    description: "Robotics design, motor control, microcontrollers, kinematics, sensor integration, and autonomous robotics programming.",
    keyTopics: ["Motor Drivers & Actuators", "Microcontrollers", "Sensor Fusion", "Robot Kinematics", "Autonomous Navigation"],
  },
  {
    name: "Japanese Spoken Course",
    code: "TVK-JPN-15",
    category: "Language & Communication",
    duration: "3 Months",
    mode: "Online Interactive",
    fees: 20000,
    description: "Foundational Japanese language proficiency: Hiragana, Katakana, basic Kanji, conversational speaking, and corporate etiquette.",
    keyTopics: ["Hiragana & Katakana", "Daily Conversational Phrases", "JLPT N5 Preparation", "Corporate Japanese Etiquette"],
  },
  {
    name: "AI and Data Science",
    code: "TVK-ADS-16",
    category: "Data & AI",
    duration: "6 Months",
    mode: "Online / Offline",
    fees: 48000,
    description: "Comprehensive dual specialization in AI and Data Science from data preprocessing and machine learning to generative AI applications.",
    keyTopics: ["Python for AI", "Machine Learning", "Deep Learning", "Generative AI & LLMs", "MLOps & Cloud Deployment"],
  },
];

export class CourseService {
  private seeded = false;

  async ensureDefaultCourses(): Promise<void> {
    if (this.seeded) return;
    try {
      const count = await CourseModel.countDocuments();
      if (count === 0) {
        for (const item of SEED_COURSES) {
          const courseId = `CRS-${Date.now()}-${randomUUID().slice(0, 6)}`;
          const tracks = buildDefaultTracks(item.fees || 30000);
          await CourseModel.create({
            ...item,
            _id: courseId,
            tracks,
            status: "ACTIVE",
            createdBy: "System Administration",
            lastModifiedBy: "System Administration",
          });
        }
      }
      this.seeded = true;
    } catch (err) {
      console.warn("Course seeding check non-blocking warning:", err);
    }
  }

  async list(rawQuery: unknown, _account: AuthenticatedAccount) {
    await this.ensureDefaultCourses();
    const query = courseQuerySchema.parse(rawQuery);
    const filter: FilterQuery<CourseRecord> = {};

    if (query.status && query.status !== "ALL") {
      filter.status = query.status;
    }

    if (query.category && query.category !== "ALL") {
      filter.category = query.category;
    }

    if (query.hasCurriculum === "YES") {
      filter.curriculumFileId = { $ne: null };
    } else if (query.hasCurriculum === "NO") {
      filter.curriculumFileId = null;
    }

    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: expression },
        { code: expression },
        { category: expression },
        { description: expression },
      ];
    }

    const items = await CourseModel.find(filter).sort({ name: 1 });
    return items.map((c) => {
      ensureCourseTracks(c);
      return c.toJSON();
    });
  }

  async get(id: string): Promise<Record<string, unknown>> {
    const course = await CourseModel.findById(id);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");
    ensureCourseTracks(course);
    return course.toJSON();
  }

  async create(rawInput: unknown, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can add new courses.");
    }
    const input = courseCreateSchema.parse(rawInput);

    const duplicate = await CourseModel.findOne({ name: new RegExp(`^${input.name.trim()}$`, "i") });
    if (duplicate) {
      throw new HttpError(409, "COURSE_DUPLICATE", `A course named '${input.name}' already exists.`);
    }

    const courseId = `CRS-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const tracks = (input.tracks && input.tracks.length > 0)
      ? input.tracks
      : buildDefaultTracks(input.fees || 0);

    const course = await CourseModel.create({
      ...input,
      _id: courseId,
      tracks,
      createdBy: account.name,
      createdByUserId: account.id,
      lastModifiedBy: account.name,
      lastModifiedByUserId: account.id,
    });

    return course.toJSON();
  }

  async update(id: string, rawInput: unknown, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can edit or modify courses.");
    }
    const input = courseUpdateSchema.parse(rawInput);
    const course = await CourseModel.findById(id);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    if (input.name && input.name.trim().toLowerCase() !== course.name.toLowerCase()) {
      const duplicate = await CourseModel.findOne({
        _id: { $ne: id },
        name: new RegExp(`^${input.name.trim()}$`, "i"),
      });
      if (duplicate) {
        throw new HttpError(409, "COURSE_DUPLICATE", `Another course named '${input.name}' already exists.`);
      }
    }

    if (input.tracks && Array.isArray(input.tracks)) {
      const existingTracks = course.tracks || [];
      course.tracks = input.tracks.map((t) => {
        const existing = existingTracks.find((e) => e.duration.toLowerCase() === t.duration.toLowerCase());
        return {
          duration: t.duration,
          fees: t.fees,
          curriculumFileId: existing?.curriculumFileId,
          curriculumFileName: existing?.curriculumFileName,
          curriculumFileType: existing?.curriculumFileType,
          curriculumFileSize: existing?.curriculumFileSize,
          curriculumUploadedAt: existing?.curriculumUploadedAt,
          curriculumUploadedBy: existing?.curriculumUploadedBy,
        };
      }) as any;
      delete input.tracks;
    }

    Object.assign(course, input);
    course.lastModifiedBy = account.name;
    course.lastModifiedByUserId = account.id;
    await course.save();

    return course.toJSON();
  }

  async delete(id: string, account: AuthenticatedAccount): Promise<{ success: boolean; deletedId: string }> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can delete courses.");
    }
    const course = await CourseModel.findById(id);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    // Delete attached curriculum file if present
    if (course.curriculumFileId) {
      await CurriculumFileModel.deleteOne({ _id: course.curriculumFileId });
    }

    await CourseModel.deleteOne({ _id: id });
    return { success: true, deletedId: id };
  }

  // --- Duration Track Operations ---

  async updateTrackFee(
    courseId: string,
    duration: string,
    fees: number,
    account: AuthenticatedAccount,
  ): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can edit course duration track fees.");
    }
    const course = await CourseModel.findById(courseId);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    ensureCourseTracks(course);
    const norm = duration.trim().toLowerCase();
    const track = course.tracks?.find((t) => t.duration.toLowerCase() === norm);
    if (!track) {
      throw new HttpError(404, "TRACK_NOT_FOUND", `Duration track '${duration}' not found for this course.`);
    }

    track.fees = Math.max(0, Number(fees) || 0);
    course.lastModifiedBy = account.name;
    course.lastModifiedByUserId = account.id;
    await course.save();

    return course.toJSON();
  }

  async uploadTrackCurriculum(
    courseId: string,
    duration: string,
    file: Express.Multer.File,
    account: AuthenticatedAccount,
  ): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can upload curriculum documents.");
    }
    const course = await CourseModel.findById(courseId);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    ensureCourseTracks(course);
    const norm = duration.trim().toLowerCase();
    const track = course.tracks?.find((t) => t.duration.toLowerCase() === norm);
    if (!track) {
      throw new HttpError(404, "TRACK_NOT_FOUND", `Duration track '${duration}' not found for this course.`);
    }

    // Delete previous track curriculum file if replacing
    if (track.curriculumFileId) {
      await CurriculumFileModel.deleteOne({ _id: track.curriculumFileId });
    }

    const originalName = file.originalname.replace(/[\\/\u0000-\u001f]/g, "_").slice(-255);
    const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
    const fileType = ext.replace(".", "").toUpperCase();

    const createdFile = await CurriculumFileModel.create({
      originalName,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size,
      courseId: course.id,
      uploadedByUserId: account.id,
      uploadedByName: account.name,
      data: file.buffer,
    });

    track.curriculumFileId = createdFile.id;
    track.curriculumFileName = originalName;
    track.curriculumFileType = fileType;
    track.curriculumFileSize = file.size;
    track.curriculumUploadedAt = new Date();
    track.curriculumUploadedBy = account.name;

    course.lastModifiedBy = account.name;
    course.lastModifiedByUserId = account.id;
    await course.save();

    return course.toJSON();
  }

  async deleteTrackCurriculum(
    courseId: string,
    duration: string,
    account: AuthenticatedAccount,
  ): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can delete curriculum documents.");
    }
    const course = await CourseModel.findById(courseId);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    ensureCourseTracks(course);
    const norm = duration.trim().toLowerCase();
    const track = course.tracks?.find((t) => t.duration.toLowerCase() === norm);
    if (!track) {
      throw new HttpError(404, "TRACK_NOT_FOUND", `Duration track '${duration}' not found for this course.`);
    }

    if (track.curriculumFileId) {
      await CurriculumFileModel.deleteOne({ _id: track.curriculumFileId });
    }

    track.curriculumFileId = null;
    track.curriculumFileName = "";
    track.curriculumFileType = "";
    track.curriculumFileSize = 0;
    track.curriculumUploadedAt = null;
    track.curriculumUploadedBy = "";

    course.lastModifiedBy = account.name;
    course.lastModifiedByUserId = account.id;
    await course.save();

    return course.toJSON();
  }

  // --- Curriculum Upload & Download ---

  async uploadCurriculum(
    courseId: string,
    file: Express.Multer.File,
    account: AuthenticatedAccount,
  ): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can upload curriculum documents.");
    }
    const course = await CourseModel.findById(courseId);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    // Delete previous curriculum file if replacing
    if (course.curriculumFileId) {
      await CurriculumFileModel.deleteOne({ _id: course.curriculumFileId });
    }

    const originalName = file.originalname.replace(/[\\/\u0000-\u001f]/g, "_").slice(-255);
    const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
    const fileType = ext.replace(".", "").toUpperCase();

    const createdFile = await CurriculumFileModel.create({
      originalName,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size,
      courseId: course.id,
      uploadedByUserId: account.id,
      uploadedByName: account.name,
      data: file.buffer,
    });

    course.curriculumFileId = createdFile.id;
    course.curriculumFileName = originalName;
    course.curriculumFileType = fileType;
    course.curriculumFileSize = file.size;
    course.curriculumUploadedAt = new Date();
    course.lastModifiedBy = account.name;
    course.lastModifiedByUserId = account.id;

    // Also mirror to 3 Months track if not yet set
    ensureCourseTracks(course);
    const track3M = course.tracks?.find((t) => t.duration.toLowerCase() === "3 months");
    if (track3M && !track3M.curriculumFileId) {
      track3M.curriculumFileId = createdFile.id;
      track3M.curriculumFileName = originalName;
      track3M.curriculumFileType = fileType;
      track3M.curriculumFileSize = file.size;
      track3M.curriculumUploadedAt = new Date();
      track3M.curriculumUploadedBy = account.name;
    }

    await course.save();
    return course.toJSON();
  }

  async deleteCurriculum(courseId: string, account: AuthenticatedAccount): Promise<Record<string, unknown>> {
    if (account.role !== "MANAGER") {
      throw new HttpError(403, "FORBIDDEN", "Only Managers/Admins can delete curriculum documents.");
    }
    const course = await CourseModel.findById(courseId);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    if (course.curriculumFileId) {
      await CurriculumFileModel.deleteOne({ _id: course.curriculumFileId });
    }

    course.curriculumFileId = null;
    course.curriculumFileName = "";
    course.curriculumFileType = "";
    course.curriculumFileSize = 0;
    course.curriculumUploadedAt = null;
    course.lastModifiedBy = account.name;
    course.lastModifiedByUserId = account.id;
    await course.save();

    return course.toJSON();
  }

  async getCurriculumFile(courseId: string, duration?: string): Promise<{ file: CurriculumFileRecord; course: CourseRecord; duration?: string }> {
    const course = await CourseModel.findById(courseId);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");

    ensureCourseTracks(course);
    let targetFileId: string | null = null;
    let trackDuration: string | undefined = undefined;

    if (duration) {
      const norm = duration.trim().toLowerCase();
      const track = course.tracks?.find((t) => t.duration.toLowerCase() === norm);
      if (track?.curriculumFileId) {
        targetFileId = track.curriculumFileId;
        trackDuration = track.duration;
      }
    }

    if (!targetFileId) {
      targetFileId = course.curriculumFileId || null;
    }

    if (!targetFileId) {
      throw new HttpError(404, "CURRICULUM_NOT_FOUND", "No curriculum document uploaded for this course.");
    }

    const file = await CurriculumFileModel.findById(targetFileId);
    if (!file) throw new HttpError(404, "FILE_NOT_FOUND", "Curriculum file record was not found in storage.");

    return { file, course, duration: trackDuration };
  }

  async getCurriculumFileById(fileId: string): Promise<{ file: CurriculumFileRecord; course: CourseRecord }> {
    const file = await CurriculumFileModel.findById(fileId);
    if (!file) throw new HttpError(404, "FILE_NOT_FOUND", "Curriculum file record was not found in storage.");
    const course = await CourseModel.findById(file.courseId);
    if (!course) throw new HttpError(404, "COURSE_NOT_FOUND", "Course not found.");
    return { file, course };
  }

  async getCurriculumForCandidateCourse(
    candidateCourseName?: string | null,
    candidateDuration?: string | null,
  ): Promise<{
    available: boolean;
    courseName: string;
    courseId?: string;
    duration?: string;
    fees?: number;
    fileId?: string;
    curriculumFileName?: string;
    curriculumFileType?: string;
    curriculumFileSize?: number;
    curriculumUploadedAt?: Date | null;
  }> {
    await this.ensureDefaultCourses();
    const cleanedName = normalizeCourseTitle(candidateCourseName);
    if (!cleanedName) {
      return { available: false, courseName: "Not Specified" };
    }

    // 1. Try exact regex match (case-insensitive) on cleaned course name
    let course = await CourseModel.findOne({
      name: new RegExp(`^${cleanedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });

    // 2. Try & <-> and variation
    if (!course) {
      const altName = cleanedName.includes("&")
        ? cleanedName.replace(/&/g, "and")
        : cleanedName.replace(/\band\b/gi, "&");
      course = await CourseModel.findOne({
        name: new RegExp(`^${altName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      });
    }

    // 3. Try substring regex match
    if (!course) {
      course = await CourseModel.findOne({
        name: new RegExp(cleanedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      });
    }

    // 4. Try matching against all existing courses by inclusion
    if (!course) {
      const allCourses = await CourseModel.find();
      const lowerQuery = cleanedName.toLowerCase();
      course = allCourses.find((c) => {
        const lowerName = c.name.toLowerCase();
        return lowerName.includes(lowerQuery) || lowerQuery.includes(lowerName);
      }) || null;
    }

    if (!course) {
      return {
        available: false,
        courseName: cleanedName,
        duration: candidateDuration || undefined,
      };
    }

    ensureCourseTracks(course);
    const norm = (candidateDuration || "").trim().toLowerCase();
    const track = norm
      ? course.tracks?.find((t) => t.duration.toLowerCase() === norm)
      : undefined;

    // Target specific duration track curriculum, or fallback to course curriculum
    const targetFileId = track?.curriculumFileId || course.curriculumFileId;
    const targetFileName = track?.curriculumFileId ? track.curriculumFileName : course.curriculumFileName;
    const targetFileType = track?.curriculumFileId ? track.curriculumFileType : course.curriculumFileType;
    const targetFileSize = track?.curriculumFileId ? track.curriculumFileSize : course.curriculumFileSize;
    const targetUploadedAt = track?.curriculumFileId ? track.curriculumUploadedAt : course.curriculumUploadedAt;

    if (!targetFileId) {
      return {
        available: false,
        courseName: course.name,
        courseId: course.id,
        duration: track?.duration || candidateDuration || course.duration,
        fees: track?.fees ?? course.fees,
      };
    }

    return {
      available: true,
      courseName: course.name,
      courseId: course.id,
      duration: track?.duration || course.duration,
      fees: track?.fees ?? course.fees,
      fileId: targetFileId,
      curriculumFileName: targetFileName,
      curriculumFileType: targetFileType,
      curriculumFileSize: targetFileSize,
      curriculumUploadedAt: targetUploadedAt,
    };
  }
}

export const courseService = new CourseService();
