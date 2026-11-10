import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { TrainerModel, TrainerRecord, TrainerAvailabilityStatus, TrainerStatus, TrainerEmploymentType } from "../models/trainer.model";
import { CourseTrainerModel, CourseTrainerRecord } from "../models/course-trainer.model";
import { TrainerAllocationHistoryModel, TrainerAllocationHistoryRecord, TrainerAllocationAction } from "../models/trainer-allocation-history.model";
import { CandidateModel, CandidateRecord } from "../models/candidate.model";
import { CourseModel } from "../models/course.model";
import { TrainerBatchModel, TrainerBatchRecord } from "../models/trainer-batch.model";
import { TrainerAttendanceModel, TrainerAttendanceRecord } from "../models/trainer-attendance.model";
import { StudentScorecardModel, StudentScorecardRecord } from "../models/student-scorecard.model";
import { TrainerFeedbackModel, TrainerFeedbackRecord } from "../models/trainer-feedback.model";
import { FacultyAttendanceModel, FacultyAttendanceRecord, FacultyLeaveType } from "../models/faculty-attendance.model";
import { HolidayModel, HolidayRecord } from "../models/holiday.model";
import { facultyNotificationService } from "./faculty-notification.service";
import { getNextTrainerId } from "./counter.service";
import { HttpError } from "../middleware/error-handler";
import { AuthenticatedAccount } from "../models/user.model";

export interface CreateTrainerInput {
  name: string;
  email: string;
  phone?: string;
  qualification?: string;
  specialization?: string;
  skills?: string[];
  assignedCourses?: string[];
  qualifiedCourses?: string[];
  employmentType?: TrainerEmploymentType;
  maxCapacity?: number;
  availability?: TrainerAvailabilityStatus;
  status?: TrainerStatus;
  hourlyRate?: number;
  contractTerms?: string;
  documents?: Array<{ name: string; url?: string; uploadedAt?: Date }>;
  notes?: string;
}

export interface UpdateTrainerInput {
  name?: string;
  email?: string;
  phone?: string;
  qualification?: string;
  specialization?: string;
  skills?: string[];
  assignedCourses?: string[];
  qualifiedCourses?: string[];
  employmentType?: TrainerEmploymentType;
  maxCapacity?: number;
  availability?: TrainerAvailabilityStatus;
  status?: TrainerStatus;
  hourlyRate?: number;
  contractTerms?: string;
  documents?: Array<{ name: string; url?: string; uploadedAt?: Date }>;
  notes?: string;
}

export interface UpdateAvailabilityInput {
  availability: TrainerAvailabilityStatus;
  absenceStartDate?: Date | string | null;
  expectedReturnDate?: Date | string | null;
  actualReturnDate?: Date | string | null;
  absenceReason?: string;
}

export class TrainerService {
  /**
   * Helper to normalize course names for comparison
   */
  private normalizeCourse(name?: string | null): string {
    return (name || "").trim().toLowerCase();
  }

  /**
   * Recalculates and updates the `currentStudentCount` field for all trainers or a specific trainer
   */
  async syncTrainerStudentCounts(trainerId?: string): Promise<void> {
    const trainerFilter = trainerId ? { _id: trainerId } : {};
    const trainers = await TrainerModel.find(trainerFilter).select("_id").lean();

    for (const trainer of trainers) {
      const count = await CandidateModel.countDocuments({
        trainerId: trainer._id,
        status: { $nin: ["ARCHIVED", "REJECTED"] },
        courseCompleted: { $ne: true },
      });

      await TrainerModel.updateOne({ _id: trainer._id }, { $set: { currentStudentCount: count } });
    }
  }

  /**
   * Section A: Overview Metrics
   */
  async getOverview(): Promise<{
    totalTrainers: number;
    availableTrainers: number;
    absentTrainers: number;
    totalActiveStudents: number;
    unassignedStudents: number;
    coursesWithoutTrainers: number;
    trainerWorkloads: Array<TrainerRecord & {
      remainingCapacity: number;
      utilizationPercent: number;
      todayStatus?: "PRESENT" | "NOT_CHECKED_IN" | "ON_LEAVE" | "ABSENT";
      checkInTime?: Date | string | null;
    }>;
    absentTrainersWithStudents?: Array<{
      trainerId: string;
      trainerName: string;
      trainerEmail: string;
      availability: string;
      absenceReason?: string;
      absenceStartDate?: Date | string | null;
      expectedReturnDate?: Date | string | null;
      affectedStudentCount: number;
      qualifiedCourses: string[];
    }>;
  }> {
    await this.syncTrainerStudentCounts();

    const today = new Date().toISOString().split("T")[0];

    const [allTrainers, activeCourses, totalActiveStudents, unassignedStudents, courseAllocations, todayAttendanceRecords] =
      await Promise.all([
        TrainerModel.find().sort({ name: 1 }).lean(),
        CourseModel.find({ status: "ACTIVE" }).select("_id name").lean(),
        CandidateModel.countDocuments({
          courseName: { $exists: true, $ne: "" },
          status: { $nin: ["ARCHIVED", "REJECTED"] },
          courseCompleted: { $ne: true },
        }),
        CandidateModel.countDocuments({
          courseName: { $exists: true, $ne: "" },
          status: { $nin: ["ARCHIVED", "REJECTED"] },
          courseCompleted: { $ne: true },
          $or: [{ trainerId: null }, { trainerId: "" }, { trainerAllocationStatus: "UNASSIGNED" }],
        }),
        CourseTrainerModel.find().lean(),
        FacultyAttendanceModel.find({ date: today }).lean(),
      ]);

    const todayAttendanceMap = new Map<string, any>();
    todayAttendanceRecords.forEach((r) => todayAttendanceMap.set(r.trainerId, r));

    const allocatedCourseIds = new Set(
      courseAllocations
        .filter((ca) => Boolean(ca.primaryTrainerId))
        .map((ca) => ca.courseId || ca.courseName)
    );

    const coursesWithoutTrainers = activeCourses.filter(
      (c) => !allocatedCourseIds.has(c._id) && !allocatedCourseIds.has(c.name)
    ).length;

    const availableTrainers = allTrainers.filter((t) => {
      const att = todayAttendanceMap.get(t._id);
      if (att) return t.status === "ACTIVE" && att.status === "PRESENT";
      return t.status === "ACTIVE" && t.availability === "AVAILABLE";
    }).length;

    const absentTrainers = allTrainers.filter((t) => {
      const att = todayAttendanceMap.get(t._id);
      if (att) return t.status === "ACTIVE" && ["ABSENT", "ON_LEAVE"].includes(att.status);
      return t.status === "ACTIVE" && ["ABSENT", "ON_LEAVE", "UNAVAILABLE"].includes(t.availability);
    }).length;

    const absentTrainersWithStudents = allTrainers
      .filter((t) => {
        const att = todayAttendanceMap.get(t._id);
        const isAbsentToday = att
          ? ["ABSENT", "ON_LEAVE"].includes(att.status)
          : ["ABSENT", "ON_LEAVE", "UNAVAILABLE"].includes(t.availability);
        return t.status === "ACTIVE" && isAbsentToday && (t.currentStudentCount || 0) > 0;
      })
      .map((t) => {
        const att = todayAttendanceMap.get(t._id);
        return {
          trainerId: t._id,
          trainerName: t.name,
          trainerEmail: t.email,
          availability: att?.status || t.availability,
          absenceReason: att?.leaveReason || t.absenceReason || "",
          absenceStartDate: att?.date || t.absenceStartDate,
          expectedReturnDate: att?.expectedReturnDate || t.expectedReturnDate,
          affectedStudentCount: t.currentStudentCount || 0,
          qualifiedCourses: t.qualifiedCourses || [],
        };
      });

    const trainerWorkloads = allTrainers.map((t: any) => {
      const remainingCapacity = Math.max(0, (t.maxCapacity || 20) - (t.currentStudentCount || 0));
      const utilizationPercent = Math.min(
        100,
        Math.round(((t.currentStudentCount || 0) / (t.maxCapacity || 20)) * 100)
      );

      const todayRecord = todayAttendanceMap.get(t._id);
      let todayStatus: "PRESENT" | "NOT_CHECKED_IN" | "ON_LEAVE" | "ABSENT" = "NOT_CHECKED_IN";
      let effectiveAvailability = t.availability;

      if (todayRecord) {
        if (todayRecord.status === "PRESENT") {
          todayStatus = "PRESENT";
          effectiveAvailability = "AVAILABLE";
        } else if (todayRecord.status === "ON_LEAVE") {
          todayStatus = "ON_LEAVE";
          effectiveAvailability = "ON_LEAVE";
        } else if (todayRecord.status === "ABSENT") {
          todayStatus = "ABSENT";
          effectiveAvailability = "ABSENT";
        }
      } else {
        if (t.availability === "ON_LEAVE") {
          todayStatus = "ON_LEAVE";
          effectiveAvailability = "ON_LEAVE";
        } else if (t.availability === "ABSENT") {
          todayStatus = "ABSENT";
          effectiveAvailability = "ABSENT";
        } else {
          todayStatus = "NOT_CHECKED_IN";
          effectiveAvailability = "NOT_CHECKED_IN";
        }
      }

      return {
        ...t,
        id: t._id,
        availability: effectiveAvailability,
        todayStatus,
        checkInTime: todayRecord?.checkInTime || null,
        remainingCapacity,
        utilizationPercent,
      };
    });

    return {
      totalTrainers: allTrainers.length,
      availableTrainers,
      absentTrainers,
      totalActiveStudents,
      unassignedStudents,
      coursesWithoutTrainers,
      trainerWorkloads,
      absentTrainersWithStudents,
    };
  }

  /**
   * Section B: Trainer Directory
   */
  async getTrainers(filters?: {
    search?: string;
    status?: string;
    availability?: string;
    employmentType?: string;
    course?: string;
  }): Promise<TrainerRecord[]> {
    await this.syncTrainerStudentCounts();

    const query: Record<string, unknown> = {};

    if (filters?.status && filters.status !== "ALL") {
      query["status"] = filters.status;
    }

    if (filters?.availability && filters.availability !== "ALL") {
      query["availability"] = filters.availability;
    }

    if (filters?.employmentType && filters.employmentType !== "ALL") {
      query["employmentType"] = filters.employmentType;
    }

    if (filters?.course && filters.course !== "ALL") {
      query["$or"] = [
        { qualifiedCourses: { $regex: new RegExp(filters.course, "i") } },
        { assignedCourses: { $regex: new RegExp(filters.course, "i") } },
      ];
    }

    if (filters?.search) {
      const reg = new RegExp(filters.search.trim(), "i");
      query["$or"] = [
        { name: reg },
        { email: reg },
        { phone: reg },
        { _id: reg },
        { specialization: reg },
        { skills: { $in: [reg] } },
      ];
    }

    const trainers = await TrainerModel.find(query).sort({ createdAt: -1 }).lean();
    return trainers.map((t: any) => ({
      ...t,
      id: t._id,
    }));
  }

  async getTrainerById(trainerId: string): Promise<{
    trainer: TrainerRecord;
    assignedStudents: CandidateRecord[];
    assignedCoursesDetails: CourseTrainerRecord[];
  }> {
    const trainer = await TrainerModel.findById(trainerId).lean();
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${trainerId}' not found.`);
    }

    const [assignedStudents, assignedCoursesDetails] = await Promise.all([
      CandidateModel.find({
        trainerId,
        status: { $nin: ["ARCHIVED", "REJECTED"] },
        courseCompleted: { $ne: true },
      }).lean(),
      CourseTrainerModel.find({
        $or: [
          { primaryTrainerId: trainerId },
          { "backupTrainers.trainerId": trainerId },
        ],
      }).lean(),
    ]);

    return {
      trainer,
      assignedStudents,
      assignedCoursesDetails,
    };
  }

  async createTrainer(input: CreateTrainerInput, actor?: AuthenticatedAccount): Promise<TrainerRecord> {
    const cleanEmail = input.email.trim().toLowerCase();
    const existing = await TrainerModel.findOne({ email: cleanEmail });
    if (existing) {
      throw new HttpError(409, "CONFLICT", `A trainer with email '${cleanEmail}' already exists.`);
    }

    const trainerId = await getNextTrainerId();

    const trainer = await TrainerModel.create({
      _id: trainerId,
      name: input.name.trim(),
      email: cleanEmail,
      phone: input.phone?.trim() || "",
      qualification: input.qualification?.trim() || "",
      specialization: input.specialization?.trim() || "",
      skills: Array.isArray(input.skills) ? input.skills.map((s) => s.trim()).filter(Boolean) : [],
      assignedCourses: Array.isArray(input.assignedCourses) ? input.assignedCourses : [],
      qualifiedCourses: Array.isArray(input.qualifiedCourses) ? input.qualifiedCourses : [],
      employmentType: input.employmentType || "FULL_TIME",
      maxCapacity: Number(input.maxCapacity) || 20,
      currentStudentCount: 0,
      availability: input.availability || "AVAILABLE",
      status: input.status || "ACTIVE",
      hourlyRate: Number(input.hourlyRate) || 0,
      contractTerms: input.contractTerms?.trim() || "",
      documents: Array.isArray(input.documents)
        ? input.documents.map((d) => ({ name: d.name, url: d.url || "", uploadedAt: d.uploadedAt || new Date() }))
        : [],
      notes: input.notes?.trim() || "",
      createdBy: actor?.name || "Manager",
      createdByUserId: actor?.id || "",
      accountPassword: "TVK@Trainer2026",
      accountPasswordHash: await bcrypt.hash("TVK@Trainer2026", 10),
      mustChangePassword: true,
    });

    return trainer.toJSON() as TrainerRecord;
  }

  async updateTrainer(
    trainerId: string,
    input: UpdateTrainerInput,
    _actor?: AuthenticatedAccount
  ): Promise<TrainerRecord> {
    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${trainerId}' not found.`);
    }

    if (input.email) {
      const cleanEmail = input.email.trim().toLowerCase();
      if (cleanEmail !== trainer.email) {
        const existing = await TrainerModel.findOne({ email: cleanEmail, _id: { $ne: trainerId } });
        if (existing) {
          throw new HttpError(409, "CONFLICT", `A trainer with email '${cleanEmail}' already exists.`);
        }
        trainer.email = cleanEmail;
      }
    }

    if (input.name !== undefined) trainer.name = input.name.trim();
    if (input.phone !== undefined) trainer.phone = input.phone.trim();
    if (input.qualification !== undefined) trainer.qualification = input.qualification.trim();
    if (input.specialization !== undefined) trainer.specialization = input.specialization.trim();
    if (input.skills !== undefined) {
      trainer.skills = Array.isArray(input.skills) ? input.skills.map((s) => s.trim()).filter(Boolean) : [];
    }
    if (input.assignedCourses !== undefined) trainer.assignedCourses = input.assignedCourses;
    if (input.qualifiedCourses !== undefined) trainer.qualifiedCourses = input.qualifiedCourses;
    if (input.employmentType !== undefined) trainer.employmentType = input.employmentType;
    if (input.maxCapacity !== undefined) trainer.maxCapacity = Math.max(1, Number(input.maxCapacity));
    if (input.availability !== undefined) trainer.availability = input.availability;
    if (input.status !== undefined) trainer.status = input.status;
    if (input.hourlyRate !== undefined) trainer.hourlyRate = Math.max(0, Number(input.hourlyRate));
    if (input.contractTerms !== undefined) trainer.contractTerms = input.contractTerms.trim();
    if (input.documents !== undefined) {
      trainer.documents = Array.isArray(input.documents)
        ? input.documents.map((d) => ({ name: d.name, url: d.url || "", uploadedAt: d.uploadedAt || new Date() }))
        : [];
    }
    if (input.notes !== undefined) trainer.notes = input.notes.trim();

    await trainer.save();
    return trainer.toJSON() as TrainerRecord;
  }

  async toggleTrainerStatus(trainerId: string, status: TrainerStatus): Promise<TrainerRecord> {
    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${trainerId}' not found.`);
    }

    trainer.status = status;
    await trainer.save();
    return trainer.toJSON() as TrainerRecord;
  }

  /**
   * Section C: Course Allocation
   */
  async getCourseAllocations(): Promise<
    Array<{
      courseId: string;
      courseName: string;
      courseCode: string;
      category: string;
      duration: string;
      primaryTrainer: { id: string; name: string; email: string; currentCount: number; maxCapacity: number } | null;
      backupTrainers: Array<{ id: string; name: string; email: string }>;
      enrolledStudentCount: number;
      qualifiedTrainers: Array<{ id: string; name: string; email: string; availability: string; remainingCapacity: number }>;
    }>
  > {
    const [courses, allocations, allTrainers] = await Promise.all([
      CourseModel.find({ status: "ACTIVE" }).lean(),
      CourseTrainerModel.find().lean(),
      TrainerModel.find({ status: "ACTIVE" }).lean(),
    ]);

    const allocationMap = new Map<string, CourseTrainerRecord>();
    for (const alloc of allocations) {
      allocationMap.set(alloc.courseId, alloc);
      allocationMap.set(alloc.courseName.toLowerCase(), alloc);
    }

    const trainerMap = new Map<string, TrainerRecord>();
    for (const t of allTrainers) {
      trainerMap.set(t._id, t);
    }

    const results = [];

    for (const course of courses) {
      const alloc = allocationMap.get(course._id) || allocationMap.get(course.name.toLowerCase());

      const enrolledStudentCount = await CandidateModel.countDocuments({
        courseName: course.name,
        status: { $nin: ["ARCHIVED", "REJECTED"] },
        courseCompleted: { $ne: true },
      });

      let primaryTrainer = null;
      if (alloc?.primaryTrainerId && trainerMap.has(alloc.primaryTrainerId)) {
        const t = trainerMap.get(alloc.primaryTrainerId)!;
        primaryTrainer = {
          id: t._id,
          name: t.name,
          email: t.email,
          currentCount: t.currentStudentCount,
          maxCapacity: t.maxCapacity,
        };
      }

      const backupTrainers = (alloc?.backupTrainers || [])
        .map((bt) => {
          const t = trainerMap.get(bt.trainerId);
          return {
            id: bt.trainerId,
            name: bt.trainerName,
            email: t?.email || "",
          };
        });

      // Filter trainers qualified for this course
      const qualifiedTrainers = allTrainers
        .filter((t) => {
          const normCourse = course.name.toLowerCase();
          return (
            (t.qualifiedCourses || []).some((qc) => qc.toLowerCase() === normCourse) ||
            t.specialization?.toLowerCase().includes(normCourse) ||
            normCourse.includes(t.specialization?.toLowerCase() || "")
          );
        })
        .map((t) => ({
          id: t._id,
          name: t.name,
          email: t.email,
          availability: t.availability,
          remainingCapacity: Math.max(0, t.maxCapacity - t.currentStudentCount),
        }));

      results.push({
        courseId: course._id,
        courseName: course.name,
        courseCode: course.code || "",
        category: course.category || "General IT",
        duration: course.duration || "3 Months",
        primaryTrainer,
        backupTrainers,
        enrolledStudentCount,
        qualifiedTrainers,
      });
    }

    return results;
  }

  async setCourseAllocation(
    courseId: string,
    input: {
      primaryTrainerId: string | null;
      backupTrainerIds?: string[];
      notes?: string;
    },
    actor?: AuthenticatedAccount
  ): Promise<CourseTrainerRecord> {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      throw new HttpError(404, "NOT_FOUND", `Course with ID '${courseId}' not found.`);
    }

    let primaryTrainerName: string | null = null;
    if (input.primaryTrainerId) {
      const trainer = await TrainerModel.findById(input.primaryTrainerId);
      if (!trainer) {
        throw new HttpError(404, "NOT_FOUND", `Primary trainer '${input.primaryTrainerId}' not found.`);
      }
      if (trainer.status !== "ACTIVE") {
        throw new HttpError(400, "BAD_REQUEST", `Primary trainer '${trainer.name}' is inactive.`);
      }
      primaryTrainerName = trainer.name;

      // Update trainer's assigned courses
      if (!trainer.assignedCourses.includes(course.name)) {
        trainer.assignedCourses.push(course.name);
        await trainer.save();
      }
    }

    const backupTrainers: Array<{ trainerId: string; trainerName: string }> = [];
    if (Array.isArray(input.backupTrainerIds)) {
      for (const bId of input.backupTrainerIds) {
        if (!bId || bId === input.primaryTrainerId) continue;
        const bTrainer = await TrainerModel.findById(bId);
        if (bTrainer && bTrainer.status === "ACTIVE") {
          backupTrainers.push({ trainerId: bTrainer._id, trainerName: bTrainer.name });
          if (!bTrainer.assignedCourses.includes(course.name)) {
            bTrainer.assignedCourses.push(course.name);
            await bTrainer.save();
          }
        }
      }
    }

    const allocation = await CourseTrainerModel.findOneAndUpdate(
      { courseId: course._id },
      {
        courseId: course._id,
        courseName: course.name,
        primaryTrainerId: input.primaryTrainerId || null,
        primaryTrainerName,
        backupTrainers,
        notes: input.notes?.trim() || "",
        allocatedBy: actor?.name || "Manager",
        allocatedByUserId: actor?.id || "",
        allocatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return allocation.toJSON() as CourseTrainerRecord;
  }

  async removeCourseAllocation(courseId: string): Promise<void> {
    const alloc = await CourseTrainerModel.findOne({ courseId });
    if (alloc) {
      if (alloc.primaryTrainerId) {
        await TrainerModel.updateOne(
          { _id: alloc.primaryTrainerId },
          { $pull: { assignedCourses: alloc.courseName } }
        );
      }
      for (const bt of alloc.backupTrainers) {
        await TrainerModel.updateOne(
          { _id: bt.trainerId },
          { $pull: { assignedCourses: alloc.courseName } }
        );
      }
      await CourseTrainerModel.deleteOne({ courseId });
    }
  }

  /**
   * Section D: Student Allocation
   */
  async getEligibleStudents(filters?: {
    search?: string;
    course?: string;
    trainerId?: string;
    allocationStatus?: "ALL" | "ASSIGNED" | "UNASSIGNED";
  }): Promise<
    Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      enrolledCourse: string;
      trainerId: string | null;
      trainerName: string | null;
      trainerEmail: string | null;
      trainerAssignedAt: Date | null;
      trainerAllocationStatus: string;
    }>
  > {
    const query: Record<string, unknown> = {
      courseName: { $exists: true, $ne: "" },
      status: { $nin: ["ARCHIVED", "REJECTED"] },
      courseCompleted: { $ne: true },
    };

    if (filters?.course && filters.course !== "ALL") {
      query["courseName"] = { $regex: new RegExp(filters.course.trim(), "i") };
    }

    if (filters?.trainerId && filters.trainerId !== "ALL") {
      query["trainerId"] = filters.trainerId;
    }

    if (filters?.allocationStatus === "ASSIGNED") {
      query["trainerId"] = { $nin: [null, ""] };
    } else if (filters?.allocationStatus === "UNASSIGNED") {
      query["$or"] = [{ trainerId: null }, { trainerId: "" }, { trainerAllocationStatus: "UNASSIGNED" }];
    }

    if (filters?.search) {
      const reg = new RegExp(filters.search.trim(), "i");
      query["$and"] = [
        {
          $or: [{ name: reg }, { email: reg }, { phone: reg }, { _id: reg }],
        },
      ];
    }

    const candidates = await CandidateModel.find(query).sort({ appliedDate: -1 }).lean();

    return candidates.map((c) => ({
      id: c._id,
      name: c.name || "Student",
      email: c.email || "",
      phone: c.phone || "",
      enrolledCourse: c.courseName || c.position || "Training Course",
      trainerId: c.trainerId || null,
      trainerName: c.trainerName || null,
      trainerEmail: c.trainerEmail || null,
      trainerAssignedAt: c.trainerAssignedAt || null,
      trainerAllocationStatus: c.trainerId ? (c.trainerAllocationStatus || "ASSIGNED") : "UNASSIGNED",
    }));
  }

  async allocateStudent(
    studentId: string,
    targetTrainerId: string,
    reason?: string,
    actor?: AuthenticatedAccount
  ): Promise<void> {
    const student = await CandidateModel.findById(studentId);
    if (!student) {
      throw new HttpError(404, "NOT_FOUND", `Student with ID '${studentId}' not found.`);
    }

    const targetTrainer = await TrainerModel.findById(targetTrainerId);
    if (!targetTrainer) {
      throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${targetTrainerId}' not found.`);
    }

    if (targetTrainer.status !== "ACTIVE") {
      throw new HttpError(400, "BAD_REQUEST", `Trainer '${targetTrainer.name}' is inactive.`);
    }

    if (targetTrainer.availability !== "AVAILABLE") {
      throw new HttpError(
        400,
        "BAD_REQUEST",
        `Trainer '${targetTrainer.name}' is currently ${targetTrainer.availability.toLowerCase().replace("_", " ")}.`
      );
    }

    // Check capacity
    const currentCount = await CandidateModel.countDocuments({
      trainerId: targetTrainer._id,
      status: { $nin: ["ARCHIVED", "REJECTED"] },
      courseCompleted: { $ne: true },
    });

    if (currentCount >= targetTrainer.maxCapacity) {
      throw new HttpError(
        400,
        "CAPACITY_EXCEEDED",
        `Trainer '${targetTrainer.name}' has reached maximum student capacity (${targetTrainer.maxCapacity}).`
      );
    }

    const previousTrainerId = student.trainerId || null;
    const previousTrainerName = student.trainerName || null;
    const isReassignment = Boolean(previousTrainerId && previousTrainerId !== targetTrainer._id);

    student.trainerId = targetTrainer._id;
    student.trainerName = targetTrainer.name;
    student.trainerEmail = targetTrainer.email;
    student.trainerAssignedAt = new Date();
    student.trainerAllocationStatus = isReassignment ? "REASSIGNED" : "ASSIGNED";
    await student.save();

    // Log in history
    await TrainerAllocationHistoryModel.create({
      _id: randomUUID(),
      studentId: student._id,
      studentName: student.name,
      courseName: student.courseName || "Training Course",
      previousTrainerId,
      previousTrainerName,
      newTrainerId: targetTrainer._id,
      newTrainerName: targetTrainer.name,
      action: isReassignment ? "REASSIGNMENT" : "INITIAL_ALLOCATION",
      reason: reason || (isReassignment ? "Manager reassigned student" : "Initial trainer allocation"),
      updatedBy: actor?.name || "Manager",
      updatedByUserId: actor?.id || "",
      allocatedAt: new Date(),
    });

    await this.syncTrainerStudentCounts(targetTrainer._id);
    if (previousTrainerId) {
      await this.syncTrainerStudentCounts(previousTrainerId);
    }
  }

  async allocateBulkStudents(
    studentIds: string[],
    targetTrainerId: string,
    reason?: string,
    actor?: AuthenticatedAccount
  ): Promise<{ allocatedCount: number }> {
    if (!studentIds.length) {
      throw new HttpError(400, "BAD_REQUEST", "Select at least one student.");
    }

    const targetTrainer = await TrainerModel.findById(targetTrainerId);
    if (!targetTrainer) {
      throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${targetTrainerId}' not found.`);
    }

    if (targetTrainer.status !== "ACTIVE") {
      throw new HttpError(400, "BAD_REQUEST", `Trainer '${targetTrainer.name}' is inactive.`);
    }

    // Capacity check
    const currentCount = await CandidateModel.countDocuments({
      trainerId: targetTrainer._id,
      status: { $nin: ["ARCHIVED", "REJECTED"] },
      courseCompleted: { $ne: true },
    });

    const remainingCapacity = targetTrainer.maxCapacity - currentCount;
    if (studentIds.length > remainingCapacity) {
      throw new HttpError(
        400,
        "CAPACITY_EXCEEDED",
        `Selected ${studentIds.length} students exceeds trainer '${targetTrainer.name}' remaining capacity of ${remainingCapacity} (Max: ${targetTrainer.maxCapacity}, Current: ${currentCount}).`
      );
    }

    const students = await CandidateModel.find({ _id: { $in: studentIds } });
    const touchedTrainerIds = new Set<string>([targetTrainer._id]);

    for (const student of students) {
      const prevTrainerId = student.trainerId || null;
      const prevTrainerName = student.trainerName || null;
      if (prevTrainerId) touchedTrainerIds.add(prevTrainerId);

      const isReassignment = Boolean(prevTrainerId && prevTrainerId !== targetTrainer._id);

      student.trainerId = targetTrainer._id;
      student.trainerName = targetTrainer.name;
      student.trainerEmail = targetTrainer.email;
      student.trainerAssignedAt = new Date();
      student.trainerAllocationStatus = isReassignment ? "REASSIGNED" : "ASSIGNED";
      await student.save();

      await TrainerAllocationHistoryModel.create({
        _id: randomUUID(),
        studentId: student._id,
        studentName: student.name,
        courseName: student.courseName || "Training Course",
        previousTrainerId: prevTrainerId,
        previousTrainerName: prevTrainerName,
        newTrainerId: targetTrainer._id,
        newTrainerName: targetTrainer.name,
        action: isReassignment ? "REASSIGNMENT" : "INITIAL_ALLOCATION",
        reason: reason || "Bulk allocation by Manager",
        updatedBy: actor?.name || "Manager",
        updatedByUserId: actor?.id || "",
        allocatedAt: new Date(),
      });
    }

    for (const id of touchedTrainerIds) {
      await this.syncTrainerStudentCounts(id);
    }

    return { allocatedCount: students.length };
  }

  /**
   * Section E: Trainer Availability and Absence Management
   */
  async updateAvailability(
    trainerId: string,
    input: UpdateAvailabilityInput,
    actor?: AuthenticatedAccount
  ): Promise<{
    trainer: TrainerRecord;
    affectedStudentCount: number;
    affectedStudents: Array<{ id: string; name: string; courseName: string }>;
    eligibleReplacements: Array<{
      trainerId: string;
      trainerName: string;
      currentCount: number;
      maxCapacity: number;
      remainingCapacity: number;
      courses: string[];
    }>;
  }> {
    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${trainerId}' not found.`);
    }

    trainer.availability = input.availability;
    if (input.absenceStartDate !== undefined) {
      trainer.absenceStartDate = input.absenceStartDate ? new Date(input.absenceStartDate) : null;
    }
    if (input.expectedReturnDate !== undefined) {
      trainer.expectedReturnDate = input.expectedReturnDate ? new Date(input.expectedReturnDate) : null;
    }
    if (input.actualReturnDate !== undefined) {
      trainer.actualReturnDate = input.actualReturnDate ? new Date(input.actualReturnDate) : null;
    }
    if (input.absenceReason !== undefined) {
      trainer.absenceReason = input.absenceReason;
    }

    await trainer.save();

    // Synchronize today's real-time faculty attendance record with the new availability status
    const todayStr = new Date().toISOString().split("T")[0];
    const dailyDocId = `${trainer._id}_${todayStr}`;
    try {
      if (input.availability === "AVAILABLE") {
        await FacultyAttendanceModel.findByIdAndUpdate(
          dailyDocId,
          {
            _id: dailyDocId,
            trainerId: trainer._id,
            trainerName: trainer.name,
            trainerEmail: trainer.email,
            date: todayStr,
            status: "PRESENT",
            checkInTime: new Date(),
            leaveReason: null,
            leaveType: null,
            expectedReturnDate: null,
          },
          { upsert: true }
        );
      } else if (["ABSENT", "ON_LEAVE", "UNAVAILABLE"].includes(input.availability)) {
        await FacultyAttendanceModel.findByIdAndUpdate(
          dailyDocId,
          {
            _id: dailyDocId,
            trainerId: trainer._id,
            trainerName: trainer.name,
            trainerEmail: trainer.email,
            date: todayStr,
            status: input.availability === "ON_LEAVE" ? "ON_LEAVE" : "ABSENT",
            leaveReason: input.absenceReason || null,
            leaveType: input.availability === "ON_LEAVE" ? "CASUAL" : "UNINFORMED",
            expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : null,
          },
          { upsert: true }
        );
      }
    } catch {
      // Non-blocking sync fallback
    }

    // Identify affected students if trainer is absent / on leave / unavailable
    const isUnavailable = ["ABSENT", "ON_LEAVE", "UNAVAILABLE"].includes(input.availability);
    let affectedStudents: Array<{ id: string; name: string; courseName: string }> = [];
    let eligibleReplacements: Array<{
      trainerId: string;
      trainerName: string;
      currentCount: number;
      maxCapacity: number;
      remainingCapacity: number;
      courses: string[];
    }> = [];

    if (isUnavailable) {
      const students = await CandidateModel.find({
        trainerId,
        status: { $nin: ["ARCHIVED", "REJECTED"] },
        courseCompleted: { $ne: true },
      })
        .select("_id name courseName")
        .lean();

      affectedStudents = students.map((s) => ({
        id: s._id,
        name: s.name,
        courseName: s.courseName || "Training Course",
      }));

      // Find replacement trainers who are ACTIVE, AVAILABLE, and have remaining capacity
      const candidatesForReplacement = await TrainerModel.find({
        _id: { $ne: trainerId },
        status: "ACTIVE",
        availability: "AVAILABLE",
      }).lean();

      for (const r of candidatesForReplacement) {
        const count = await CandidateModel.countDocuments({
          trainerId: r._id,
          status: { $nin: ["ARCHIVED", "REJECTED"] },
          courseCompleted: { $ne: true },
        });

        const remainingCapacity = Math.max(0, r.maxCapacity - count);
        eligibleReplacements.push({
          trainerId: r._id,
          trainerName: r.name,
          currentCount: count,
          maxCapacity: r.maxCapacity,
          remainingCapacity,
          courses: [...(r.qualifiedCourses || []), ...(r.assignedCourses || [])],
        });
      }
    }

    return {
      trainer: trainer.toJSON() as TrainerRecord,
      affectedStudentCount: affectedStudents.length,
      affectedStudents,
      eligibleReplacements,
    };
  }

  async getAbsenceImpact(trainerId: string): Promise<{
    trainer: TrainerRecord;
    affectedStudents: Array<{ id: string; name: string; courseName: string; email: string }>;
    eligibleReplacements: Array<{
      trainerId: string;
      trainerName: string;
      currentCount: number;
      maxCapacity: number;
      remainingCapacity: number;
      courses: string[];
    }>;
  }> {
    const trainer = await TrainerModel.findById(trainerId).lean();
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${trainerId}' not found.`);
    }

    const students = await CandidateModel.find({
      trainerId,
      status: { $nin: ["ARCHIVED", "REJECTED"] },
      courseCompleted: { $ne: true },
    })
      .select("_id name courseName email")
      .lean();

    const affectedStudents = students.map((s) => ({
      id: s._id,
      name: s.name,
      courseName: s.courseName || "Training Course",
      email: s.email || "",
    }));

    const otherTrainers = await TrainerModel.find({
      _id: { $ne: trainerId },
      status: "ACTIVE",
      availability: "AVAILABLE",
    }).lean();

    const eligibleReplacements = [];
    for (const r of otherTrainers) {
      const count = await CandidateModel.countDocuments({
        trainerId: r._id,
        status: { $nin: ["ARCHIVED", "REJECTED"] },
        courseCompleted: { $ne: true },
      });
      eligibleReplacements.push({
        trainerId: r._id,
        trainerName: r.name,
        currentCount: count,
        maxCapacity: r.maxCapacity,
        remainingCapacity: Math.max(0, r.maxCapacity - count),
        courses: [...(r.qualifiedCourses || []), ...(r.assignedCourses || [])],
      });
    }

    return {
      trainer,
      affectedStudents,
      eligibleReplacements,
    };
  }

  async reassignAbsenceStudents(
    sourceTrainerId: string,
    assignments: Array<{ studentId: string; targetTrainerId: string }>,
    reason?: string,
    actor?: AuthenticatedAccount
  ): Promise<{ reassignedCount: number }> {
    const sourceTrainer = await TrainerModel.findById(sourceTrainerId);
    const touchedTrainers = new Set<string>([sourceTrainerId]);

    let count = 0;
    for (const item of assignments) {
      const student = await CandidateModel.findById(item.studentId);
      const targetTrainer = await TrainerModel.findById(item.targetTrainerId);
      if (!student || !targetTrainer) continue;

      touchedTrainers.add(targetTrainer._id);

      student.trainerId = targetTrainer._id;
      student.trainerName = targetTrainer.name;
      student.trainerEmail = targetTrainer.email;
      student.trainerAssignedAt = new Date();
      student.trainerAllocationStatus = "REASSIGNED";
      await student.save();

      await TrainerAllocationHistoryModel.create({
        _id: randomUUID(),
        studentId: student._id,
        studentName: student.name,
        courseName: student.courseName || "Training Course",
        previousTrainerId: sourceTrainer?._id || sourceTrainerId,
        previousTrainerName: sourceTrainer?.name || "Previous Trainer",
        newTrainerId: targetTrainer._id,
        newTrainerName: targetTrainer.name,
        action: "ABSENCE_REASSIGNMENT",
        reason: reason || `Absence reassignment from ${sourceTrainer?.name || sourceTrainerId}`,
        updatedBy: actor?.name || "Manager",
        updatedByUserId: actor?.id || "",
        allocatedAt: new Date(),
      });

      count++;
    }

    for (const id of touchedTrainers) {
      await this.syncTrainerStudentCounts(id);
    }

    return { reassignedCount: count };
  }

  /**
   * Section F: Automatic Workload Distribution (Auto Allocate)
   */
  async previewAutoAllocation(): Promise<{
    totalUnassigned: number;
    allocatableCount: number;
    unallocatableCount: number;
    proposedAllocations: Array<{
      studentId: string;
      studentName: string;
      courseName: string;
      proposedTrainerId: string;
      proposedTrainerName: string;
      trainerRemainingCapacity: number;
    }>;
    courseBreakdowns: Array<{
      courseName: string;
      unassignedCount: number;
      availableTrainersCount: number;
      allocatableCount: number;
    }>;
    warnings: string[];
  }> {
    await this.syncTrainerStudentCounts();

    const unassignedStudents = await CandidateModel.find({
      courseName: { $exists: true, $ne: "" },
      status: { $nin: ["ARCHIVED", "REJECTED"] },
      courseCompleted: { $ne: true },
      $or: [{ trainerId: null }, { trainerId: "" }, { trainerAllocationStatus: "UNASSIGNED" }],
    })
      .select("_id name courseName")
      .lean();

    const activeTrainers = await TrainerModel.find({
      status: "ACTIVE",
      availability: "AVAILABLE",
    }).lean();

    const trainerCapacityMap = new Map<string, number>();
    for (const t of activeTrainers) {
      const remaining = Math.max(0, t.maxCapacity - (t.currentStudentCount || 0));
      trainerCapacityMap.set(t._id, remaining);
    }

    // Group students by course
    const courseGroupMap = new Map<string, Array<{ _id: string; name: string; courseName: string }>>();
    for (const s of unassignedStudents) {
      const cName = (s.courseName || "").trim();
      const list = courseGroupMap.get(cName) || [];
      list.push({ _id: s._id, name: s.name, courseName: cName });
      courseGroupMap.set(cName, list);
    }

    const proposedAllocations: Array<{
      studentId: string;
      studentName: string;
      courseName: string;
      proposedTrainerId: string;
      proposedTrainerName: string;
      trainerRemainingCapacity: number;
    }> = [];

    const courseBreakdowns: Array<{
      courseName: string;
      unassignedCount: number;
      availableTrainersCount: number;
      allocatableCount: number;
    }> = [];

    const warnings: string[] = [];

    for (const [courseName, students] of courseGroupMap.entries()) {
      const normCourse = courseName.toLowerCase();

      // Find trainers qualified for this course
      const qualified = activeTrainers.filter((t) => {
        const hasQualified = (t.qualifiedCourses || []).some(
          (qc) => qc.toLowerCase() === normCourse || normCourse.includes(qc.toLowerCase())
        );
        const hasAssigned = (t.assignedCourses || []).some(
          (ac) => ac.toLowerCase() === normCourse || normCourse.includes(ac.toLowerCase())
        );
        const hasSpec = t.specialization?.toLowerCase().includes(normCourse);
        return hasQualified || hasAssigned || hasSpec;
      });

      // Sort trainers by lowest workload (most remaining capacity)
      qualified.sort((a, b) => {
        const remA = trainerCapacityMap.get(a._id) || 0;
        const remB = trainerCapacityMap.get(b._id) || 0;
        return remB - remA;
      });

      let allocatedForThisCourse = 0;

      if (!qualified.length) {
        warnings.push(`No active & available trainers found qualified for course '${courseName}'. ${students.length} students remain unassigned.`);
      } else {
        // Distribute round-robin among qualified trainers with remaining capacity
        for (const student of students) {
          const eligibleTrainer = qualified.find((t) => (trainerCapacityMap.get(t._id) || 0) > 0);

          if (eligibleTrainer) {
            const currentRem = trainerCapacityMap.get(eligibleTrainer._id)!;
            trainerCapacityMap.set(eligibleTrainer._id, currentRem - 1);

            proposedAllocations.push({
              studentId: student._id,
              studentName: student.name,
              courseName: student.courseName,
              proposedTrainerId: eligibleTrainer._id,
              proposedTrainerName: eligibleTrainer.name,
              trainerRemainingCapacity: currentRem - 1,
            });

            allocatedForThisCourse++;

            // Re-sort qualified trainers to balance workload
            qualified.sort((a, b) => {
              const remA = trainerCapacityMap.get(a._id) || 0;
              const remB = trainerCapacityMap.get(b._id) || 0;
              return remB - remA;
            });
          }
        }

        if (allocatedForThisCourse < students.length) {
          warnings.push(
            `Insufficient trainer capacity for course '${courseName}'. Only ${allocatedForThisCourse} of ${students.length} students could be auto-allocated.`
          );
        }
      }

      courseBreakdowns.push({
        courseName,
        unassignedCount: students.length,
        availableTrainersCount: qualified.length,
        allocatableCount: allocatedForThisCourse,
      });
    }

    return {
      totalUnassigned: unassignedStudents.length,
      allocatableCount: proposedAllocations.length,
      unallocatableCount: unassignedStudents.length - proposedAllocations.length,
      proposedAllocations,
      courseBreakdowns,
      warnings,
    };
  }

  async applyAutoAllocation(
    assignments: Array<{ studentId: string; targetTrainerId: string }>,
    actor?: AuthenticatedAccount
  ): Promise<{ allocatedCount: number }> {
    if (!assignments.length) {
      throw new HttpError(400, "BAD_REQUEST", "No allocations provided to apply.");
    }

    const touchedTrainerIds = new Set<string>();
    let count = 0;

    for (const item of assignments) {
      const student = await CandidateModel.findById(item.studentId);
      const trainer = await TrainerModel.findById(item.targetTrainerId);
      if (!student || !trainer) continue;

      touchedTrainerIds.add(trainer._id);

      const prevTrainerId = student.trainerId || null;
      const prevTrainerName = student.trainerName || null;

      student.trainerId = trainer._id;
      student.trainerName = trainer.name;
      student.trainerEmail = trainer.email;
      student.trainerAssignedAt = new Date();
      student.trainerAllocationStatus = "ASSIGNED";
      await student.save();

      await TrainerAllocationHistoryModel.create({
        _id: randomUUID(),
        studentId: student._id,
        studentName: student.name,
        courseName: student.courseName || "Training Course",
        previousTrainerId: prevTrainerId,
        previousTrainerName: prevTrainerName,
        newTrainerId: trainer._id,
        newTrainerName: trainer.name,
        action: "AUTO_ALLOCATION",
        reason: "Automatic workload distribution by Manager",
        updatedBy: actor?.name || "Manager",
        updatedByUserId: actor?.id || "",
        allocatedAt: new Date(),
      });

      count++;
    }

    for (const id of touchedTrainerIds) {
      await this.syncTrainerStudentCounts(id);
    }

    return { allocatedCount: count };
  }

  /**
   * Section G: Allocation History
   */
  async getAllocationHistory(filters?: {
    studentId?: string;
    trainerId?: string;
    courseName?: string;
    action?: string;
    limit?: number;
  }): Promise<TrainerAllocationHistoryRecord[]> {
    const query: Record<string, unknown> = {};

    if (filters?.studentId) query["studentId"] = filters.studentId;
    if (filters?.trainerId) {
      query["$or"] = [{ newTrainerId: filters.trainerId }, { previousTrainerId: filters.trainerId }];
    }
    if (filters?.courseName) {
      query["courseName"] = { $regex: new RegExp(filters.courseName.trim(), "i") };
    }
    if (filters?.action && filters.action !== "ALL") {
      query["action"] = filters.action;
    }

    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 50));

    return TrainerAllocationHistoryModel.find(query).sort({ allocatedAt: -1 }).limit(limit).lean();
  }

  /**
   * Batch & Schedule Management
   */
  async getBatches(filters?: { trainerId?: string; courseName?: string; status?: string }): Promise<TrainerBatchRecord[]> {
    const query: Record<string, unknown> = {};
    if (filters?.trainerId) query["trainerId"] = filters.trainerId;
    if (filters?.courseName) query["courseName"] = { $regex: new RegExp(filters.courseName.trim(), "i") };
    if (filters?.status && filters.status !== "ALL") query["status"] = filters.status;

    const batches = await TrainerBatchModel.find(query).sort({ startDate: -1 }).lean();
    return batches.map((b: any) => ({
      ...b,
      id: b._id,
    }));
  }

  async createBatch(
    input: {
      batchName: string;
      courseName: string;
      trainerId: string;
      timeSlot?: string;
      days?: string[];
      meetingLink?: string;
      classroomLocation?: string;
      startDate?: Date | string;
      endDate?: Date | string;
      totalSessions?: number;
      status?: "UPCOMING" | "ACTIVE" | "COMPLETED";
      studentIds?: string[];
      notes?: string;
    },
    actor?: AuthenticatedAccount
  ): Promise<TrainerBatchRecord> {
    const trainerId = (input.trainerId || "").trim();
    if (!trainerId) {
      throw new HttpError(400, "BAD_REQUEST", "Trainer ID is required to create a batch.");
    }

    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${trainerId}' not found.`);

    const batchId = `BATCH-${randomUUID().slice(0, 8).toUpperCase()}`;

    let computedEndDate = input.endDate ? new Date(input.endDate) : null;
    if (!computedEndDate && input.totalSessions && input.totalSessions > 0) {
      const startStr = input.startDate
        ? new Date(input.startDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const schedule = await this.calculateBatchSchedule({
        startDate: startStr,
        totalSessions: input.totalSessions,
        days: Array.isArray(input.days) && input.days.length ? input.days : ["Mon", "Tue", "Wed", "Thu", "Fri"],
      });
      computedEndDate = new Date(`${schedule.endDate}T00:00:00.000Z`);
    }

    const batch = await TrainerBatchModel.create({
      _id: batchId,
      batchName: input.batchName.trim(),
      courseName: input.courseName.trim(),
      trainerId: trainer._id,
      trainerName: trainer.name,
      timeSlot: input.timeSlot?.trim() || "10:00 AM - 12:00 PM",
      days: Array.isArray(input.days) && input.days.length ? input.days : ["Mon", "Wed", "Fri"],
      meetingLink: input.meetingLink?.trim() || "",
      classroomLocation: input.classroomLocation?.trim() || "Online Interactive",
      startDate: input.startDate ? new Date(input.startDate) : new Date(),
      endDate: computedEndDate,
      totalSessions: input.totalSessions || 0,
      status: input.status || "ACTIVE",
      studentIds: Array.isArray(input.studentIds) ? input.studentIds : [],
      notes: input.notes?.trim() || "",
      createdBy: actor?.name || "Manager",
    });

    const res = batch.toJSON() as any;
    res.id = batchId;
    return res;
  }

  async updateBatch(
    batchId: string,
    input: Partial<TrainerBatchRecord>,
    _actor?: AuthenticatedAccount
  ): Promise<TrainerBatchRecord> {
    const batch = await TrainerBatchModel.findById(batchId);
    if (!batch) throw new HttpError(404, "NOT_FOUND", `Batch '${batchId}' not found.`);

    if (input.batchName !== undefined) batch.batchName = input.batchName.trim();
    if (input.courseName !== undefined) batch.courseName = input.courseName.trim();
    if (input.timeSlot !== undefined) batch.timeSlot = input.timeSlot.trim();
    if (input.days !== undefined) batch.days = input.days;
    if (input.meetingLink !== undefined) batch.meetingLink = input.meetingLink.trim();
    if (input.classroomLocation !== undefined) batch.classroomLocation = input.classroomLocation.trim();
    if (input.status !== undefined) batch.status = input.status;
    if (input.studentIds !== undefined) batch.studentIds = input.studentIds;
    if (input.notes !== undefined) batch.notes = input.notes.trim();

    if (input.trainerId && input.trainerId !== batch.trainerId) {
      const t = await TrainerModel.findById(input.trainerId);
      if (t) {
        batch.trainerId = t._id;
        batch.trainerName = t.name;
      }
    }

    await batch.save();
    const res = batch.toJSON() as any;
    res.id = batch._id;
    return res;
  }

  async deleteBatch(batchId: string): Promise<void> {
    await TrainerBatchModel.findByIdAndDelete(batchId);
  }

  /**
   * Attendance Tracking
   */
  async markAttendance(
    records: Array<{
      studentId: string;
      studentName: string;
      courseName: string;
      trainerId: string;
      trainerName: string;
      batchId?: string;
      date: string;
      status: "PRESENT" | "ABSENT" | "LATE";
      topicCovered?: string;
      remarks?: string;
    }>,
    actor?: AuthenticatedAccount
  ): Promise<number> {
    let count = 0;
    for (const r of records) {
      const docId = `${r.studentId}_${r.date}`;
      await TrainerAttendanceModel.findOneAndUpdate(
        { studentId: r.studentId, date: r.date },
        {
          _id: docId,
          batchId: r.batchId || "",
          courseName: r.courseName,
          trainerId: r.trainerId,
          trainerName: r.trainerName,
          studentId: r.studentId,
          studentName: r.studentName,
          date: r.date,
          status: r.status,
          topicCovered: r.topicCovered || "",
          remarks: r.remarks || "",
          markedBy: actor?.name || "Trainer",
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      count++;
    }
    return count;
  }

  async getAttendance(filters?: {
    batchId?: string;
    studentId?: string;
    trainerId?: string;
    date?: string;
    month?: string;
    courseName?: string;
  }): Promise<TrainerAttendanceRecord[]> {
    const query: Record<string, unknown> = {};
    if (filters?.batchId) query["batchId"] = filters.batchId;
    if (filters?.studentId) query["studentId"] = filters.studentId;
    if (filters?.trainerId) query["trainerId"] = filters.trainerId;
    if (filters?.month) {
      query["date"] = { $regex: new RegExp(`^${filters.month.trim()}`) };
    } else if (filters?.date) {
      if (filters.date.length === 7) {
        query["date"] = { $regex: new RegExp(`^${filters.date.trim()}`) };
      } else {
        query["date"] = filters.date.trim();
      }
    }
    if (filters?.courseName) query["courseName"] = { $regex: new RegExp(filters.courseName.trim(), "i") };

    const records = await TrainerAttendanceModel.find(query).sort({ date: -1, createdAt: -1 }).limit(2000).lean();
    return records.map((r: any) => ({
      ...r,
      id: r._id,
    }));
  }

  async getStudentTrainingSummary(studentId: string): Promise<{
    student: any;
    attendanceStats: {
      totalSessions: number;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      convertedLeaveDays?: number;
      activeStrikes?: number;
      effectivePresent?: number;
      effectiveAbsent?: number;
      attendancePercent: number;
    };
    recentAttendance: TrainerAttendanceRecord[];
    scorecards: StudentScorecardRecord[];
    assignedTrainer: TrainerRecord | null;
  }> {
    const student = await CandidateModel.findById(studentId).lean();
    if (!student) {
      throw new HttpError(404, "NOT_FOUND", `Student with ID '${studentId}' not found.`);
    }

    const [attendanceRecords, scorecards, assignedTrainer] = await Promise.all([
      TrainerAttendanceModel.find({ studentId }).sort({ date: -1 }).limit(100).lean(),
      StudentScorecardModel.find({ studentId }).sort({ assessedAt: -1 }).lean(),
      student.trainerId ? TrainerModel.findById(student.trainerId).lean() : null,
    ]);

    const totalSessions = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((a) => a.status === "PRESENT").length;
    const lateCount = attendanceRecords.filter((a) => a.status === "LATE").length;
    const absentCount = attendanceRecords.filter((a) => a.status === "ABSENT").length;
    const convertedLeaveDays = Math.floor(lateCount / 3);
    const activeStrikes = lateCount % 3;
    const effectivePresent = Math.max(0, presentCount + lateCount - convertedLeaveDays);
    const effectiveAbsent = absentCount + convertedLeaveDays;
    const attendancePercent =
      totalSessions > 0 ? Math.round((effectivePresent / totalSessions) * 100) : 100;

    return {
      student: { ...student, id: student._id },
      attendanceStats: {
        totalSessions,
        presentCount,
        lateCount,
        absentCount,
        convertedLeaveDays,
        activeStrikes,
        effectivePresent,
        effectiveAbsent,
        attendancePercent,
      },
      recentAttendance: attendanceRecords.map((a: any) => ({ ...a, id: a._id })),
      scorecards: scorecards.map((s: any) => ({ ...s, id: s._id })),
      assignedTrainer: assignedTrainer ? ({ ...assignedTrainer, id: assignedTrainer._id } as any) : null,
    };
  }

  /**
   * Student Performance & Scorecards
   */
  async saveStudentScorecard(
    input: {
      studentId: string;
      technicalScore: number;
      problemSolvingScore: number;
      communicationScore: number;
      readinessStatus: "READY" | "NEEDS_IMPROVEMENT" | "NOT_READY";
      feedback: string;
      recommendedRole?: string;
    },
    actor?: AuthenticatedAccount
  ): Promise<StudentScorecardRecord> {
    const student = await CandidateModel.findById(input.studentId);
    if (!student) throw new HttpError(404, "NOT_FOUND", `Student with ID '${input.studentId}' not found.`);

    const overall = Number(
      ((input.technicalScore + input.problemSolvingScore + input.communicationScore) / 3).toFixed(1)
    );

    const scorecard = await StudentScorecardModel.create({
      _id: randomUUID(),
      studentId: student._id,
      studentName: student.name,
      courseName: student.courseName || "Training Course",
      trainerId: student.trainerId || "UNASSIGNED",
      trainerName: student.trainerName || "Instructor",
      technicalScore: input.technicalScore,
      problemSolvingScore: input.problemSolvingScore,
      communicationScore: input.communicationScore,
      overallScore: overall,
      readinessStatus: input.readinessStatus,
      feedback: input.feedback?.trim() || "",
      recommendedRole: input.recommendedRole?.trim() || student.position || "",
      evaluatedBy: actor?.name || "Trainer",
      assessedAt: new Date(),
    });

    return scorecard.toJSON() as StudentScorecardRecord;
  }

  async getStudentScorecards(studentId?: string, courseName?: string, trainerId?: string): Promise<StudentScorecardRecord[]> {
    const query: Record<string, unknown> = {};
    if (studentId) query["studentId"] = studentId;
    if (courseName) query["courseName"] = { $regex: new RegExp(courseName.trim(), "i") };
    if (trainerId) query["trainerId"] = trainerId;

    const scorecards = await StudentScorecardModel.find(query).sort({ assessedAt: -1 }).limit(100).lean();
    return scorecards.map((s: any) => ({
      ...s,
      id: s._id,
    }));
  }

  /**
   * Trainer Ratings & Student Feedback
   */
  async submitTrainerFeedback(input: {
    trainerId: string;
    studentId: string;
    studentName: string;
    courseName: string;
    rating: number;
    feedback: string;
  }): Promise<TrainerFeedbackRecord> {
    const trainer = await TrainerModel.findById(input.trainerId);
    if (!trainer) throw new HttpError(404, "NOT_FOUND", `Trainer with ID '${input.trainerId}' not found.`);

    const fb = await TrainerFeedbackModel.create({
      _id: randomUUID(),
      trainerId: trainer._id,
      trainerName: trainer.name,
      studentId: input.studentId,
      studentName: input.studentName,
      courseName: input.courseName,
      rating: Math.max(1, Math.min(5, Number(input.rating) || 5)),
      feedback: input.feedback?.trim() || "",
      createdAt: new Date(),
    });

    // Recalculate trainer average rating
    const allFb = await TrainerFeedbackModel.find({ trainerId: trainer._id }).select("rating").lean();
    if (allFb.length > 0) {
      const sum = allFb.reduce((acc, curr) => acc + (curr.rating || 5), 0);
      trainer.averageRating = Number((sum / allFb.length).toFixed(1));
      trainer.totalRatings = allFb.length;
      await trainer.save();
    }

    return fb.toJSON() as TrainerFeedbackRecord;
  }

  async getTrainerFeedback(trainerId: string): Promise<TrainerFeedbackRecord[]> {
    return TrainerFeedbackModel.find({ trainerId }).sort({ createdAt: -1 }).limit(50).lean();
  }

  /**
   * CSV Exports
   */
  async exportTrainersCsv(): Promise<string> {
    const trainers = await TrainerModel.find().sort({ name: 1 }).lean();
    const headers = [
      "Trainer ID",
      "Name",
      "Email",
      "Phone",
      "Qualification",
      "Specialization",
      "Employment Type",
      "Hourly Rate",
      "Status",
      "Availability",
      "Max Capacity",
      "Current Students",
      "Average Rating",
    ];

    const rows = trainers.map((t) => [
      `"${t._id}"`,
      `"${t.name || ""}"`,
      `"${t.email || ""}"`,
      `"${t.phone || ""}"`,
      `"${t.qualification || ""}"`,
      `"${t.specialization || ""}"`,
      `"${t.employmentType || ""}"`,
      `"${t.hourlyRate || 0}"`,
      `"${t.status}"`,
      `"${t.availability}"`,
      t.maxCapacity,
      t.currentStudentCount,
      t.averageRating || 5.0,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  async exportAllocationsCsv(): Promise<string> {
    const students = await this.getEligibleStudents();
    const headers = ["Student ID", "Student Name", "Email", "Phone", "Enrolled Course", "Assigned Trainer", "Status", "Allocated At"];

    const rows = students.map((s) => [
      `"${s.id}"`,
      `"${s.name}"`,
      `"${s.email}"`,
      `"${s.phone}"`,
      `"${s.enrolledCourse}"`,
      `"${s.trainerName || "Unassigned"}"`,
      `"${s.trainerAllocationStatus}"`,
      `"${s.trainerAssignedAt ? new Date(s.trainerAssignedAt).toISOString() : ""}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  async exportHistoryCsv(): Promise<string> {
    const history = await this.getAllocationHistory();
    const headers = ["Date & Time", "Action", "Student ID", "Student Name", "Course", "Previous Trainer", "New Trainer", "Reason", "Updated By"];

    const rows = history.map((h) => [
      `"${new Date(h.allocatedAt).toISOString()}"`,
      `"${h.action}"`,
      `"${h.studentId}"`,
      `"${h.studentName}"`,
      `"${h.courseName}"`,
      `"${h.previousTrainerName || ""}"`,
      `"${h.newTrainerName || ""}"`,
      `"${(h.reason || "").replace(/"/g, '""')}"`,
      `"${h.updatedBy || ""}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  // ==========================================
  // TRAINER PORTAL AUTHENTICATION & CREDENTIALS
  // ==========================================
  async trainerLogin(identifier: string, password: string): Promise<{
    token: string;
    mustChangePassword: boolean;
    trainer: {
      id: string;
      name: string;
      email: string;
      phone: string;
      specialization: string;
      employmentType: string;
      availability: string;
    };
  }> {
    const cleanId = identifier.trim();
    const cleanEmail = cleanId.toLowerCase();

    const trainer = await TrainerModel.findOne({
      $or: [{ _id: cleanId }, { email: cleanEmail }],
    }).select("+accountPasswordHash");

    if (!trainer) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid Trainer ID / Email or Password.");
    }

    if (trainer.status !== "ACTIVE") {
      throw new HttpError(403, "ACCOUNT_INACTIVE", "Your trainer account is currently inactive. Contact your manager.");
    }

    let isValidPassword = false;
    if (trainer.accountPasswordHash) {
      isValidPassword = await bcrypt.compare(password, trainer.accountPasswordHash);
    } else {
      const defaultPass = trainer.accountPassword || "TVK@Trainer2026";
      if (password === defaultPass) {
        isValidPassword = true;
        trainer.accountPasswordHash = await bcrypt.hash(password, 10);
        trainer.mustChangePassword = true;
      }
    }

    if (!isValidPassword) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid Trainer ID / Email or Password.");
    }

    trainer.lastLoginAt = new Date();
    trainer.availability = "AVAILABLE";
    trainer.absenceReason = undefined;
    trainer.absenceStartDate = null;
    trainer.actualReturnDate = new Date();
    await trainer.save();

    // Automatically register daily check-in as PRESENT for today on faculty login
    if (process.env.NODE_ENV !== "test" || FacultyAttendanceModel.db?.readyState === 1) {
      try {
        await this.checkInTrainer(trainer._id);
      } catch {
        // Non-blocking fallback if attendance logging encounters transient issue
      }
    }

    const token = jwt.sign(
      {
        trainerId: trainer._id,
        role: "TRAINER",
        email: trainer.email,
        name: trainer.name,
      },
      env.jwtSecret,
      { expiresIn: "7d" }
    );

    return {
      token,
      mustChangePassword: Boolean(trainer.mustChangePassword),
      trainer: {
        id: trainer._id,
        name: trainer.name,
        email: trainer.email,
        phone: trainer.phone,
        specialization: trainer.specialization,
        employmentType: trainer.employmentType,
        availability: trainer.availability,
      },
    };
  }

  async trainerChangePassword(trainerId: string, currentPassword: string, newPassword: string): Promise<void> {
    const trainer = await TrainerModel.findById(trainerId).select("+accountPasswordHash");
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", "Trainer not found.");
    }

    if (trainer.accountPasswordHash) {
      const match = await bcrypt.compare(currentPassword, trainer.accountPasswordHash);
      if (!match) {
        throw new HttpError(400, "BAD_REQUEST", "Current password does not match.");
      }
    }

    if (!newPassword || newPassword.length < 6) {
      throw new HttpError(400, "BAD_REQUEST", "New password must be at least 6 characters long.");
    }

    trainer.accountPasswordHash = await bcrypt.hash(newPassword, 10);
    trainer.accountPassword = ""; // Cleared once user customizes it
    trainer.mustChangePassword = false;
    await trainer.save();
  }

  async getTrainerPortalProfile(trainerId: string) {
    const trainer = await TrainerModel.findById(trainerId).lean();
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", "Trainer not found.");
    }

    const today = new Date().toISOString().split("T")[0];
    const [assignedStudents, assignedBatches, recentAttendance, todayAttendance] = await Promise.all([
      CandidateModel.find({
        trainerId,
        status: { $nin: ["ARCHIVED", "REJECTED"] },
        courseCompleted: { $ne: true },
      }).lean(),
      TrainerBatchModel.find({ trainerId }).lean(),
      TrainerAttendanceModel.find({ trainerId }).sort({ date: -1 }).limit(50).lean(),
      FacultyAttendanceModel.findById(`${trainerId}_${today}`).lean(),
    ]);

    return {
      trainer: { ...trainer, id: trainer._id },
      assignedStudentsCount: assignedStudents.length,
      assignedStudents: assignedStudents.map((s: any) => ({ ...s, id: s._id })),
      assignedBatches: assignedBatches.map((b: any) => ({ ...b, id: b._id })),
      recentAttendance: recentAttendance.map((a: any) => ({ ...a, id: a._id })),
      todayAttendance: todayAttendance ? ({ ...todayAttendance, id: todayAttendance._id } as any) : null,
    };
  }

  async resetTrainerPassword(trainerId: string, _actor?: AuthenticatedAccount): Promise<{ defaultPassword: string }> {
    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) {
      throw new HttpError(404, "NOT_FOUND", "Trainer not found.");
    }

    const newDefaultPassword = `TVK@Trainer${Math.floor(1000 + Math.random() * 9000)}`;
    trainer.accountPassword = newDefaultPassword;
    trainer.accountPasswordHash = await bcrypt.hash(newDefaultPassword, 10);
    trainer.mustChangePassword = true;
    await trainer.save();

    return { defaultPassword: newDefaultPassword };
  }

  /* ------------------------------------------------------------------
   * Section F: Faculty Daily Work Attendance & Automated Leave Alerts
   * ------------------------------------------------------------------ */
  async checkInTrainer(trainerId: string): Promise<FacultyAttendanceRecord> {
    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) throw new HttpError(404, "NOT_FOUND", "Trainer not found.");

    const today = new Date().toISOString().split("T")[0];
    const docId = `${trainer._id}_${today}`;

    const existing = await FacultyAttendanceModel.findById(docId);
    let checkInTime = new Date();
    if (existing?.checkInTime) {
      checkInTime = existing.checkInTime;
    }

    let cutOffHour = 10;
    let cutOffMinute = 15;
    if (process.env.FACULTY_CHECKIN_CUTOFF && process.env.FACULTY_CHECKIN_CUTOFF.includes(":")) {
      const [h, m] = process.env.FACULTY_CHECKIN_CUTOFF.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        cutOffHour = h;
        cutOffMinute = m;
      }
    }
    const isLateCheckIn =
      Boolean(existing?.isCutoffMissed) ||
      checkInTime.getHours() > cutOffHour ||
      (checkInTime.getHours() === cutOffHour && checkInTime.getMinutes() > cutOffMinute);

    const attendance = await FacultyAttendanceModel.findByIdAndUpdate(
      docId,
      {
        _id: docId,
        trainerId: trainer._id,
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        date: today,
        status: "PRESENT",
        checkInTime,
        isLateCheckIn,
        leaveReason: null,
        leaveType: null,
        expectedReturnDate: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Reset trainer availability to AVAILABLE and clear any active absence flags
    trainer.availability = "AVAILABLE";
    trainer.absenceReason = undefined;
    trainer.absenceStartDate = null;
    trainer.actualReturnDate = new Date();
    await trainer.save();

    return attendance.toJSON() as FacultyAttendanceRecord;
  }

  async submitTrainerLeaveWithReason(
    trainerId: string,
    input: {
      startDate: string;
      endDate?: string;
      leaveType?: FacultyLeaveType;
      reason: string;
      handoverNotes?: string;
    }
  ): Promise<{ success: boolean; datesCovered: number; message: string }> {
    const trainer = await TrainerModel.findById(trainerId);
    if (!trainer) throw new HttpError(404, "NOT_FOUND", "Trainer not found.");

    if (!input.reason?.trim()) {
      throw new HttpError(400, "BAD_REQUEST", "Please provide a reason for taking leave.");
    }

    const start = new Date(input.startDate);
    const end = input.endDate ? new Date(input.endDate) : new Date(input.startDate);
    if (isNaN(start.getTime())) throw new HttpError(400, "BAD_REQUEST", "Invalid start date.");

    // Generate date list
    const dates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, "0");
      const dd = String(curr.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
      curr.setDate(curr.getDate() + 1);
    }

    for (const d of dates) {
      const docId = `${trainer._id}_${d}`;
      await FacultyAttendanceModel.findByIdAndUpdate(
        docId,
        {
          _id: docId,
          trainerId: trainer._id,
          trainerName: trainer.name,
          trainerEmail: trainer.email,
          date: d,
          status: "ON_LEAVE",
          leaveType: input.leaveType || "CASUAL",
          leaveReason: input.reason.trim(),
          expectedReturnDate: input.endDate ? new Date(input.endDate) : null,
          handoverNotes: input.handoverNotes?.trim() || null,
          managerAcknowledged: false,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    trainer.availability = "ON_LEAVE";
    trainer.absenceReason = input.reason.trim();
    trainer.absenceStartDate = new Date(input.startDate);
    trainer.expectedReturnDate = input.endDate ? new Date(input.endDate) : null;
    await trainer.save();

    // Asynchronously intimate manager via WhatsApp, Email & Activity Log
    try {
      const affectedBatches = await TrainerBatchModel.find({ trainerId: trainer._id, status: "ACTIVE" }).exec();
      const affectedCount = trainer.currentStudentCount || 0;

      void facultyNotificationService.notifyManagerOnTrainerLeave({
        trainerId: String(trainer._id),
        trainerName: trainer.name,
        trainerEmail: trainer.email,
        leaveType: input.leaveType || "CASUAL",
        leaveReason: input.reason.trim(),
        startDate: input.startDate,
        expectedReturnDate: input.endDate,
        handoverNotes: input.handoverNotes?.trim(),
        affectedStudentsCount: affectedCount,
        affectedBatchesCount: affectedBatches.length,
      });
    } catch (notifErr) {
      console.warn("[TRAINER_SERVICE] Failed to trigger leave notification:", notifErr);
    }

    return {
      success: true,
      datesCovered: dates.length,
      message: `Leave successfully submitted for ${dates.length} day(s). Management has been alerted.`,
    };
  }

  async getTrainerOwnAttendance(
    trainerId: string,
    filterOrMonth?: string | { month?: string; startDate?: string; endDate?: string }
  ): Promise<{
    stats: {
      totalWorkingDays: number;
      presentCount: number;
      leaveCount: number;
      absentCount: number;
      lateOrMissedCount?: number;
      convertedLeaveDays?: number;
      activeStrikes?: number;
      effectiveLeaveCount?: number;
      attendancePercent: number;
    };
    records: FacultyAttendanceRecord[];
    todayRecord: FacultyAttendanceRecord | null;
  }> {
    const today = new Date().toISOString().split("T")[0];
    let targetMonth: string | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (typeof filterOrMonth === "string") {
      targetMonth = filterOrMonth;
    } else if (filterOrMonth && typeof filterOrMonth === "object") {
      targetMonth = filterOrMonth.month;
      startDate = filterOrMonth.startDate;
      endDate = filterOrMonth.endDate;
    }

    const query: Record<string, any> = { trainerId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else {
      const monthPrefix = targetMonth || today.substring(0, 7);
      query.date = { $regex: new RegExp(`^${monthPrefix}`) };
    }

    const [records, todayRecord] = await Promise.all([
      FacultyAttendanceModel.find(query).sort({ date: -1 }).lean(),
      FacultyAttendanceModel.findById(`${trainerId}_${today}`).lean(),
    ]);

    const presentCount = records.filter((r) => r.status === "PRESENT").length;
    const leaveCount = records.filter((r) => r.status === "ON_LEAVE").length;
    const absentCount = records.filter((r) => r.status === "ABSENT").length;
    const lateOrMissedCount = records.filter(
      (r: any) => Boolean(r.isLateCheckIn) || Boolean(r.isCutoffMissed) || r.status === "ABSENT"
    ).length;
    const convertedLeaveDays = Math.floor(lateOrMissedCount / 3);
    const activeStrikes = lateOrMissedCount % 3;
    const effectiveLeaveCount = leaveCount + convertedLeaveDays;
    const totalWorkingDays = records.length;
    const attendancePercent = totalWorkingDays > 0 ? Math.round((presentCount / totalWorkingDays) * 100) : 100;

    return {
      stats: {
        totalWorkingDays,
        presentCount,
        leaveCount,
        absentCount,
        lateOrMissedCount,
        convertedLeaveDays,
        activeStrikes,
        effectiveLeaveCount,
        attendancePercent,
      },
      records: records.map((r: any) => ({ ...r, id: r._id })),
      todayRecord: todayRecord ? ({ ...todayRecord, id: todayRecord._id } as any) : null,
    };
  }

  async getFacultyAttendanceOverview(date?: string): Promise<{
    date: string;
    totalActiveTrainers: number;
    presentCount: number;
    onLeaveCount: number;
    absentOrNotCheckedInCount: number;
    stats?: {
      totalFaculty: number;
      present: number;
      onLeave: number;
      absent: number;
    };
    records: Array<FacultyAttendanceRecord & { affectedStudents: number; scheduledBatches: string[] }>;
    alerts: Array<{
      trainerId: string;
      trainerName: string;
      trainerEmail: string;
      status: "ON_LEAVE" | "NOT_CHECKED_IN";
      leaveReason?: string;
      leaveType?: string;
      expectedReturnDate?: Date | string | null;
      affectedStudentCount: number;
      scheduledBatches: string[];
      qualifiedBackupTrainers: Array<{ id: string; name: string; email: string; availability: string }>;
    }>;
  }> {
    const targetDate = date || new Date().toISOString().split("T")[0];

    const [allTrainers, attendanceRecords, allBatches, allStudents] = await Promise.all([
      TrainerModel.find({ status: "ACTIVE" }).lean(),
      FacultyAttendanceModel.find({ date: targetDate }).lean(),
      TrainerBatchModel.find({ status: "ACTIVE" }).lean(),
      CandidateModel.find({ status: { $nin: ["ARCHIVED", "REJECTED"] }, courseCompleted: { $ne: true } }).lean(),
    ]);

    const attendanceMap = new Map<string, any>();
    attendanceRecords.forEach((r) => attendanceMap.set(r.trainerId, r));

    // Batch mapping per trainer
    const trainerBatches = new Map<string, string[]>();
    allBatches.forEach((b) => {
      if (b.trainerId) {
        const arr = trainerBatches.get(b.trainerId) || [];
        arr.push(b.batchName);
        trainerBatches.set(b.trainerId, arr);
      }
    });

    // Student count per trainer
    const trainerStudentCounts = new Map<string, number>();
    allStudents.forEach((s) => {
      if (s.trainerId) {
        trainerStudentCounts.set(s.trainerId, (trainerStudentCounts.get(s.trainerId) || 0) + 1);
      }
    });

    const recordsWithMeta = [];
    const alerts = [];
    let presentCount = 0;
    let onLeaveCount = 0;
    let absentOrNotCheckedInCount = 0;

    for (const t of allTrainers) {
      const att = attendanceMap.get(t._id);
      const studentCount = trainerStudentCounts.get(t._id) || 0;
      const batches = trainerBatches.get(t._id) || [];

      // Available backup trainers
      const qualifiedBackups = allTrainers
        .filter((other) => other._id !== t._id && other.status === "ACTIVE" && other.availability === "AVAILABLE")
        .map((other) => ({ id: other._id, name: other.name, email: other.email, availability: other.availability }));

      if (att) {
        recordsWithMeta.push({
          ...att,
          id: att._id,
          affectedStudents: studentCount,
          scheduledBatches: batches,
        });

        if (att.status === "PRESENT") {
          presentCount++;
        } else if (att.status === "ON_LEAVE") {
          onLeaveCount++;
          if (!att.managerAcknowledged) {
            alerts.push({
              trainerId: t._id,
              trainerName: t.name,
              trainerEmail: t.email,
              status: "ON_LEAVE" as const,
              leaveReason: att.leaveReason || t.absenceReason || "Leave applied by trainer",
              leaveType: att.leaveType || "CASUAL",
              startDate: att.date || targetDate,
              expectedReturnDate: att.expectedReturnDate || t.expectedReturnDate,
              handoverNotes: att.handoverNotes,
              affectedStudentCount: studentCount,
              affectedStudentsCount: studentCount,
              scheduledBatches: batches,
              affectedBatches: batches,
              backupOptions: qualifiedBackups.map((qb) => ({
                trainerId: qb.id,
                trainerName: qb.name,
                currentStudentCount: 0,
                maxCapacity: 20,
              })),
              qualifiedBackupTrainers: qualifiedBackups,
            });
          }
        } else if (att.status === "ABSENT") {
          absentOrNotCheckedInCount++;
          if (!att.managerAcknowledged) {
            alerts.push({
              trainerId: t._id,
              trainerName: t.name,
              trainerEmail: t.email,
              status: "NOT_CHECKED_IN" as const,
              leaveReason: att.leaveReason || "Uninformed absence / Did not check in",
              leaveType: "UNINFORMED",
              startDate: att.date || targetDate,
              expectedReturnDate: null,
              affectedStudentCount: studentCount,
              affectedStudentsCount: studentCount,
              scheduledBatches: batches,
              affectedBatches: batches,
              backupOptions: qualifiedBackups.map((qb) => ({
                trainerId: qb.id,
                trainerName: qb.name,
                currentStudentCount: 0,
                maxCapacity: 20,
              })),
              qualifiedBackupTrainers: qualifiedBackups,
            });
          }
        }
      } else {
        // Trainer has not checked in today
        absentOrNotCheckedInCount++;
        if (batches.length > 0 || studentCount > 0 || t.availability === "ON_LEAVE") {
          alerts.push({
            trainerId: t._id,
            trainerName: t.name,
            trainerEmail: t.email,
            status: t.availability === "ON_LEAVE" ? ("ON_LEAVE" as const) : ("NOT_CHECKED_IN" as const),
            leaveReason: t.absenceReason || "No check-in recorded for today yet",
            leaveType: t.availability === "ON_LEAVE" ? "PLANNED" : "UNINFORMED",
            startDate: targetDate,
            expectedReturnDate: t.expectedReturnDate,
            affectedStudentCount: studentCount,
            affectedStudentsCount: studentCount,
            scheduledBatches: batches,
            affectedBatches: batches,
            backupOptions: qualifiedBackups.map((qb) => ({
              trainerId: qb.id,
              trainerName: qb.name,
              currentStudentCount: 0,
              maxCapacity: 20,
            })),
            qualifiedBackupTrainers: qualifiedBackups,
          });
        }
      }
    }

    return {
      date: targetDate,
      totalActiveTrainers: allTrainers.length,
      presentCount,
      onLeaveCount,
      absentOrNotCheckedInCount,
      stats: {
        totalFaculty: allTrainers.length,
        present: presentCount,
        onLeave: onLeaveCount,
        absent: absentOrNotCheckedInCount,
      },
      records: recordsWithMeta,
      alerts,
    };
  }

  async acknowledgeFacultyAbsence(
    trainerId: string,
    date: string,
    backupTrainerId?: string,
    _actor?: AuthenticatedAccount
  ): Promise<{ success: boolean; message: string }> {
    const docId = `${trainerId}_${date}`;
    const record = await FacultyAttendanceModel.findById(docId);

    let backupTrainerName: string | null = null;
    if (backupTrainerId) {
      const backupTrainer = await TrainerModel.findById(backupTrainerId);
      if (backupTrainer) {
        backupTrainerName = backupTrainer.name;
      }
    }

    const trainer = await TrainerModel.findById(trainerId);

    if (record) {
      record.status = "ABSENT";
      record.managerAcknowledged = true;
      if (backupTrainerId) {
        record.backupTrainerId = backupTrainerId;
        record.backupTrainerName = backupTrainerName;
      }
      await record.save();
    } else {
      await FacultyAttendanceModel.create({
        _id: docId,
        trainerId,
        trainerName: trainer?.name || "Trainer",
        date,
        status: "ABSENT",
        managerAcknowledged: true,
        backupTrainerId,
        backupTrainerName,
      });
    }

    if (trainer) {
      trainer.availability = "ABSENT";
      trainer.absenceReason = "Marked absent by Manager";
      await trainer.save();
    }

    return {
      success: true,
      message: `Trainer marked ABSENT for ${date}.${backupTrainerName ? ` Backup trainer ${backupTrainerName} assigned.` : ""}`,
    };
  }

  async getFacultyAttendanceHistory(filters: {
    startDate?: string;
    endDate?: string;
    month?: string;
    trainerId?: string;
  }): Promise<{
    stats: {
      totalDays: number;
      presentDays: number;
      leaveDays: number;
      absentDays: number;
      lateOrMissedCount?: number;
      convertedLeaveDays?: number;
      activeStrikes?: number;
      attendancePercentage: number;
    };
    records: FacultyAttendanceRecord[];
  }> {
    const query: any = {};
    if (filters.trainerId && filters.trainerId !== "ALL") {
      query.trainerId = filters.trainerId;
    }

    if (filters.startDate && filters.endDate) {
      query.date = { $gte: filters.startDate, $lte: filters.endDate };
    } else if (filters.month) {
      query.date = { $regex: `^${filters.month}` };
    }

    const [allTrainers, allBatches, allStudents, rawRecords] = await Promise.all([
      TrainerModel.find({ status: "ACTIVE" }).lean(),
      TrainerBatchModel.find({ status: "ACTIVE" }).lean(),
      CandidateModel.find({ status: { $nin: ["ARCHIVED", "REJECTED"] }, courseCompleted: { $ne: true } }).lean(),
      FacultyAttendanceModel.find(query).sort({ date: -1, trainerName: 1 }).lean(),
    ]);

    const trainerMap = new Map(allTrainers.map((t) => [t._id, t]));
    const batchMap = new Map<string, string[]>();
    for (const b of allBatches) {
      if (b.trainerId) {
        const arr = batchMap.get(b.trainerId) || [];
        arr.push(b.batchName);
        batchMap.set(b.trainerId, arr);
      }
    }
    const studentCountMap = new Map<string, number>();
    for (const s of allStudents) {
      if (s.trainerId) {
        studentCountMap.set(s.trainerId, (studentCountMap.get(s.trainerId) || 0) + 1);
      }
    }

    // Check if any training session was delivered in TrainerAttendanceModel
    const sessionQuery: any = {};
    if (filters.trainerId && filters.trainerId !== "ALL") {
      sessionQuery.trainerId = filters.trainerId;
    }
    if (filters.startDate && filters.endDate) {
      sessionQuery.date = { $gte: filters.startDate, $lte: filters.endDate };
    } else if (filters.month) {
      sessionQuery.date = { $regex: `^${filters.month}` };
    }
    const sessions = await TrainerAttendanceModel.find(sessionQuery).lean();
    const sessionDatesMap = new Map<string, any>();
    for (const s of sessions) {
      const key = `${s.trainerId}_${s.date}`;
      if (!sessionDatesMap.has(key)) {
        sessionDatesMap.set(key, s);
      }
    }

    const combinedRecords = [...rawRecords];
    const recordKeySet = new Set(rawRecords.map((r) => `${r.trainerId}_${r.date}`));

    for (const [key, s] of sessionDatesMap.entries()) {
      if (!recordKeySet.has(key)) {
        const t = trainerMap.get(s.trainerId);
        combinedRecords.push({
          _id: key,
          id: key,
          trainerId: s.trainerId,
          trainerName: s.trainerName || t?.name || "Trainer",
          trainerEmail: t?.email || "",
          date: s.date,
          status: "PRESENT",
          checkInTime: s.createdAt || new Date(`${s.date}T09:00:00Z`),
          leaveType: null,
          leaveReason: null,
          expectedReturnDate: null,
          handoverNotes: s.topicCovered ? `Class delivered: ${s.topicCovered}` : "Session conducted",
          managerAcknowledged: true,
          backupTrainerId: null,
          backupTrainerName: null,
        } as any);
        recordKeySet.add(key);
      }
    }

    combinedRecords.sort((a, b) => b.date.localeCompare(a.date) || a.trainerName.localeCompare(b.trainerName));

    const enrichedRecords = combinedRecords.map((r: any) => {
      const t = trainerMap.get(r.trainerId);
      const courses = (t?.assignedCourses && t.assignedCourses.length > 0)
        ? t.assignedCourses
        : (t?.qualifiedCourses || []);
      const batches = batchMap.get(r.trainerId) || [];
      const studentCount = studentCountMap.get(r.trainerId) || t?.currentStudentCount || 0;
      return {
        ...r,
        id: r._id || `${r.trainerId}_${r.date}`,
        assignedCourses: courses,
        scheduledBatches: batches,
        affectedStudents: studentCount,
      };
    });

    const totalDays = enrichedRecords.length;
    const presentDays = enrichedRecords.filter((r) => r.status === "PRESENT").length;
    const leaveDays = enrichedRecords.filter((r) => r.status === "ON_LEAVE").length;
    const absentDays = enrichedRecords.filter((r) => r.status === "ABSENT").length;
    const lateOrMissedCount = enrichedRecords.filter(
      (r: any) => Boolean(r.isLateCheckIn) || Boolean(r.isCutoffMissed) || r.status === "ABSENT"
    ).length;
    const convertedLeaveDays = Math.floor(lateOrMissedCount / 3);
    const activeStrikes = lateOrMissedCount % 3;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    return {
      stats: {
        totalDays,
        presentDays,
        leaveDays,
        absentDays,
        lateOrMissedCount,
        convertedLeaveDays,
        activeStrikes,
        attendancePercentage,
      },
      records: enrichedRecords as FacultyAttendanceRecord[],
    };
  }

  async exportFacultyAttendanceCsv(filters: {
    startDate?: string;
    endDate?: string;
    month?: string;
    trainerId?: string;
  }): Promise<string> {
    const data = await this.getFacultyAttendanceHistory(filters);
    const escape = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const headers = [
      "Date",
      "Trainer ID",
      "Trainer Name",
      "Allocated Courses",
      "Allocated Batches",
      "Assigned Candidates",
      "Status",
      "Check-In Status (Late/Missed)",
      "Check-In Time",
      "Leave Type",
      "Reason",
      "Expected Return Date",
      "Handover Notes",
      "Manager Acknowledged",
      "Backup Trainer",
    ];

    const rows = data.records.map((r: any) => [
      escape(r.date),
      escape(r.trainerId),
      escape(r.trainerName),
      escape(r.assignedCourses?.join("; ") || "—"),
      escape(r.scheduledBatches?.join("; ") || "—"),
      escape(r.affectedStudents ?? 0),
      escape(r.status),
      escape(r.isLateCheckIn ? "LATE CHECK-IN (Strike)" : (r.isCutoffMissed || r.status === "ABSENT" ? "MISSED CUT-OFF (Strike)" : (r.checkInTime ? "ON TIME" : "—"))),
      escape(r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : "—"),
      escape(r.leaveType || "—"),
      escape(r.leaveReason || "—"),
      escape(r.expectedReturnDate ? new Date(r.expectedReturnDate).toISOString().slice(0, 10) : "—"),
      escape(r.handoverNotes || "—"),
      escape(r.managerAcknowledged ? "YES" : "NO"),
      escape(r.backupTrainerName || "—"),
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  }

  // ==========================================
  // INSTITUTIONAL HOLIDAYS & BATCH SCHEDULER
  // ==========================================
  async getHolidays(): Promise<HolidayRecord[]> {
    return HolidayModel.find().sort({ date: 1 }).lean();
  }

  async createHoliday(input: {
    date: string;
    name: string;
    type?: "GOVERNMENT" | "INSTITUTIONAL" | "FESTIVAL" | "OTHER";
    description?: string;
  }): Promise<HolidayRecord> {
    const id = `HOL-${input.date}`;
    const holiday = await HolidayModel.findOneAndUpdate(
      { date: input.date },
      {
        _id: id,
        date: input.date,
        name: input.name.trim(),
        type: input.type || "GOVERNMENT",
        description: input.description?.trim() || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return holiday as HolidayRecord;
  }

  async deleteHoliday(id: string): Promise<void> {
    await HolidayModel.deleteOne({ $or: [{ _id: id }, { date: id }] });
  }

  async calculateBatchSchedule(params: {
    startDate: string;
    totalSessions: number;
    days?: string[];
  }): Promise<{
    startDate: string;
    endDate: string;
    totalSessions: number;
    calendarDaysSpan: number;
    sessionDates: Array<{ sessionNumber: number; date: string; dayOfWeek: string }>;
    skippedHolidays: Array<{ date: string; name: string }>;
    skippedWeekendDays: number;
  }> {
    const dayMap: Record<number, string> = {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
    };

    const targetWorkingDays = params.days && params.days.length ? params.days : ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const holidays = await HolidayModel.find().lean();
    const holidayMap = new Map<string, string>();
    for (const h of holidays) {
      holidayMap.set(h.date, h.name);
    }

    const sessionDates: Array<{ sessionNumber: number; date: string; dayOfWeek: string }> = [];
    const skippedHolidays: Array<{ date: string; name: string }> = [];
    let skippedWeekendDays = 0;

    const current = new Date(`${params.startDate}T00:00:00.000Z`);
    const totalNeeded = Math.max(1, params.totalSessions || 1);

    // Safety guard max 365 calendar days to prevent infinite loops
    let safetyCounter = 0;
    while (sessionDates.length < totalNeeded && safetyCounter < 365) {
      safetyCounter++;
      const dateStr = current.toISOString().slice(0, 10);
      const dayOfWeek = dayMap[current.getUTCDay()];

      if (!targetWorkingDays.includes(dayOfWeek)) {
        skippedWeekendDays++;
      } else if (holidayMap.has(dateStr)) {
        skippedHolidays.push({ date: dateStr, name: holidayMap.get(dateStr)! });
      } else {
        sessionDates.push({
          sessionNumber: sessionDates.length + 1,
          date: dateStr,
          dayOfWeek,
        });
      }

      if (sessionDates.length < totalNeeded) {
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    const endDate = sessionDates.length > 0 ? sessionDates[sessionDates.length - 1].date : params.startDate;
    const startObj = new Date(`${params.startDate}T00:00:00.000Z`);
    const endObj = new Date(`${endDate}T00:00:00.000Z`);
    const calendarDaysSpan = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      startDate: params.startDate,
      endDate,
      totalSessions: sessionDates.length,
      calendarDaysSpan,
      sessionDates,
      skippedHolidays,
      skippedWeekendDays,
    };
  }
}

export const trainerService = new TrainerService();
