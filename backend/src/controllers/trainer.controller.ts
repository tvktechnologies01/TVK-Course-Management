import { Request, Response } from "express";
import { trainerService } from "../services/trainer.service";
import { HttpError } from "../middleware/error-handler";
import { z } from "zod";

function getActor(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

const createTrainerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Invalid email address."),
  phone: z.string().trim().optional(),
  qualification: z.string().trim().optional(),
  specialization: z.string().trim().optional(),
  skills: z.array(z.string()).optional(),
  assignedCourses: z.array(z.string()).optional(),
  qualifiedCourses: z.array(z.string()).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).optional(),
  maxCapacity: z.number().min(1, "Max capacity must be at least 1.").optional(),
  availability: z.enum(["AVAILABLE", "ABSENT", "ON_LEAVE", "UNAVAILABLE"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: z.string().trim().optional(),
});

const updateTrainerSchema = createTrainerSchema.partial();

const updateAvailabilitySchema = z.object({
  availability: z.enum(["AVAILABLE", "ABSENT", "ON_LEAVE", "UNAVAILABLE"]),
  absenceStartDate: z.string().or(z.date()).nullable().optional(),
  expectedReturnDate: z.string().or(z.date()).nullable().optional(),
  actualReturnDate: z.string().or(z.date()).nullable().optional(),
  absenceReason: z.string().trim().optional(),
});

const allocateStudentSchema = z.object({
  targetTrainerId: z.string().min(1, "Select a target trainer."),
  reason: z.string().trim().optional(),
});

const bulkAllocateSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Select at least one student."),
  targetTrainerId: z.string().min(1, "Select a target trainer."),
  reason: z.string().trim().optional(),
});

const setCourseAllocationSchema = z.object({
  primaryTrainerId: z.string().nullable().optional(),
  backupTrainerIds: z.array(z.string()).optional(),
  notes: z.string().trim().optional(),
});

const absenceReassignSchema = z.object({
  assignments: z.array(
    z.object({
      studentId: z.string().min(1),
      targetTrainerId: z.string().min(1),
    })
  ).min(1, "Provide at least one reassignment."),
  reason: z.string().trim().optional(),
});

const applyAutoAllocateSchema = z.object({
  assignments: z.array(
    z.object({
      studentId: z.string().min(1),
      targetTrainerId: z.string().min(1),
    })
  ).min(1, "Provide at least one allocation to apply."),
});

export async function getOverview(_request: Request, response: Response): Promise<void> {
  const data = await trainerService.getOverview();
  response.json({ success: true, data });
}

export async function getTrainers(request: Request, response: Response): Promise<void> {
  const { search, status, availability, employmentType, course } = request.query;
  const data = await trainerService.getTrainers({
    search: search ? String(search) : undefined,
    status: status ? String(status) : undefined,
    availability: availability ? String(availability) : undefined,
    employmentType: employmentType ? String(employmentType) : undefined,
    course: course ? String(course) : undefined,
  });
  response.json({ success: true, data });
}

export async function getTrainerById(request: Request, response: Response): Promise<void> {
  const id = String(request.params["id"] || "");
  const data = await trainerService.getTrainerById(id);
  response.json({ success: true, data });
}

export async function createTrainer(request: Request, response: Response): Promise<void> {
  const body = createTrainerSchema.parse(request.body);
  const data = await trainerService.createTrainer(body, getActor(request));
  response.status(201).json({ success: true, data });
}

export async function updateTrainer(request: Request, response: Response): Promise<void> {
  const id = String(request.params["id"] || "");
  const body = updateTrainerSchema.parse(request.body);
  const data = await trainerService.updateTrainer(id, body, getActor(request));
  response.json({ success: true, data });
}

export async function toggleTrainerStatus(request: Request, response: Response): Promise<void> {
  const id = String(request.params["id"] || "");
  const { status } = request.body;
  if (status !== "ACTIVE" && status !== "INACTIVE") {
    throw new HttpError(400, "BAD_REQUEST", "Status must be ACTIVE or INACTIVE.");
  }
  const data = await trainerService.toggleTrainerStatus(id, status);
  response.json({ success: true, data });
}

export async function getCourseAllocations(_request: Request, response: Response): Promise<void> {
  const data = await trainerService.getCourseAllocations();
  response.json({ success: true, data });
}

export async function setCourseAllocation(request: Request, response: Response): Promise<void> {
  const courseId = String(request.params["courseId"] || "");
  const body = setCourseAllocationSchema.parse(request.body);
  const data = await trainerService.setCourseAllocation(
    courseId,
    {
      primaryTrainerId: body.primaryTrainerId ?? null,
      backupTrainerIds: body.backupTrainerIds,
      notes: body.notes,
    },
    getActor(request)
  );
  response.json({ success: true, data });
}

export async function removeCourseAllocation(request: Request, response: Response): Promise<void> {
  const courseId = String(request.params["courseId"] || "");
  await trainerService.removeCourseAllocation(courseId);
  response.json({ success: true, message: "Course allocation removed." });
}

export async function getEligibleStudents(request: Request, response: Response): Promise<void> {
  const { search, course, trainerId, allocationStatus } = request.query;
  const data = await trainerService.getEligibleStudents({
    search: search ? String(search) : undefined,
    course: course ? String(course) : undefined,
    trainerId: trainerId ? String(trainerId) : undefined,
    allocationStatus: allocationStatus as any,
  });
  response.json({ success: true, data });
}

export async function allocateStudent(request: Request, response: Response): Promise<void> {
  const studentId = String(request.params["studentId"] || "");
  const body = allocateStudentSchema.parse(request.body);
  await trainerService.allocateStudent(studentId, body.targetTrainerId, body.reason, getActor(request));
  response.json({ success: true, message: "Student allocated successfully." });
}

export async function allocateBulkStudents(request: Request, response: Response): Promise<void> {
  const body = bulkAllocateSchema.parse(request.body);
  const data = await trainerService.allocateBulkStudents(
    body.studentIds,
    body.targetTrainerId,
    body.reason,
    getActor(request)
  );
  response.json({ success: true, data });
}

export async function updateAvailability(request: Request, response: Response): Promise<void> {
  const id = String(request.params["id"] || "");
  const body = updateAvailabilitySchema.parse(request.body);
  const data = await trainerService.updateAvailability(id, body as any, getActor(request));
  response.json({ success: true, data });
}

export async function getAbsenceImpact(request: Request, response: Response): Promise<void> {
  const id = String(request.params["id"] || "");
  const data = await trainerService.getAbsenceImpact(id);
  response.json({ success: true, data });
}

export async function reassignAbsenceStudents(request: Request, response: Response): Promise<void> {
  const id = String(request.params["id"] || "");
  const body = absenceReassignSchema.parse(request.body);
  const data = await trainerService.reassignAbsenceStudents(id, body.assignments, body.reason, getActor(request));
  response.json({ success: true, data });
}

export async function previewAutoAllocation(_request: Request, response: Response): Promise<void> {
  const data = await trainerService.previewAutoAllocation();
  response.json({ success: true, data });
}

export async function applyAutoAllocation(request: Request, response: Response): Promise<void> {
  const body = applyAutoAllocateSchema.parse(request.body);
  const data = await trainerService.applyAutoAllocation(body.assignments, getActor(request));
  response.json({ success: true, data });
}

export async function getAllocationHistory(request: Request, response: Response): Promise<void> {
  const { studentId, trainerId, courseName, action, limit } = request.query;
  const data = await trainerService.getAllocationHistory({
    studentId: studentId ? String(studentId) : undefined,
    trainerId: trainerId ? String(trainerId) : undefined,
    courseName: courseName ? String(courseName) : undefined,
    action: action ? String(action) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  response.json({ success: true, data });
}

// Batches
export async function getBatches(request: Request, response: Response): Promise<void> {
  const { trainerId, courseName, status } = request.query;
  const data = await trainerService.getBatches({
    trainerId: trainerId ? String(trainerId) : undefined,
    courseName: courseName ? String(courseName) : undefined,
    status: status ? String(status) : undefined,
  });
  response.json({ success: true, data });
}

export async function createBatch(request: Request, response: Response): Promise<void> {
  const data = await trainerService.createBatch(request.body, getActor(request));
  response.status(201).json({ success: true, data });
}

export async function updateBatch(request: Request, response: Response): Promise<void> {
  const batchId = String(request.params["id"] || "");
  const data = await trainerService.updateBatch(batchId, request.body, getActor(request));
  response.json({ success: true, data });
}

export async function deleteBatch(request: Request, response: Response): Promise<void> {
  const batchId = String(request.params["id"] || "");
  await trainerService.deleteBatch(batchId);
  response.json({ success: true, message: "Batch deleted successfully." });
}

// Attendance
export async function markAttendance(request: Request, response: Response): Promise<void> {
  const { records } = request.body;
  if (!Array.isArray(records) || !records.length) {
    throw new HttpError(400, "BAD_REQUEST", "Provide attendance records array.");
  }
  const count = await trainerService.markAttendance(records, getActor(request));
  response.json({ success: true, message: `Marked attendance for ${count} students.` });
}

export async function getAttendance(request: Request, response: Response): Promise<void> {
  const { batchId, studentId, trainerId, date, month, courseName } = request.query;
  const data = await trainerService.getAttendance({
    batchId: batchId ? String(batchId) : undefined,
    studentId: studentId ? String(studentId) : undefined,
    trainerId: trainerId ? String(trainerId) : undefined,
    date: date ? String(date) : undefined,
    month: month ? String(month) : undefined,
    courseName: courseName ? String(courseName) : undefined,
  });
  response.json({ success: true, data });
}

export async function getStudentTrainingSummary(request: Request, response: Response): Promise<void> {
  const studentId = String(request.params["studentId"] || "");
  const data = await trainerService.getStudentTrainingSummary(studentId);
  response.json({ success: true, data });
}

// Scorecards
export async function saveStudentScorecard(request: Request, response: Response): Promise<void> {
  const data = await trainerService.saveStudentScorecard(request.body, getActor(request));
  response.status(201).json({ success: true, data });
}

export async function getStudentScorecards(request: Request, response: Response): Promise<void> {
  const { studentId, courseName } = request.query;
  const data = await trainerService.getStudentScorecards(
    studentId ? String(studentId) : undefined,
    courseName ? String(courseName) : undefined
  );
  response.json({ success: true, data });
}

// Feedback
export async function submitTrainerFeedback(request: Request, response: Response): Promise<void> {
  const data = await trainerService.submitTrainerFeedback(request.body);
  response.status(201).json({ success: true, data });
}

export async function getTrainerFeedback(request: Request, response: Response): Promise<void> {
  const trainerId = String(request.params["trainerId"] || "");
  const data = await trainerService.getTrainerFeedback(trainerId);
  response.json({ success: true, data });
}

// CSV Exports
export async function exportTrainersCsv(_request: Request, response: Response): Promise<void> {
  const csv = await trainerService.exportTrainersCsv();
  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", 'attachment; filename="trainers.csv"');
  response.send(csv);
}

export async function exportAllocationsCsv(_request: Request, response: Response): Promise<void> {
  const csv = await trainerService.exportAllocationsCsv();
  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", 'attachment; filename="student-allocations.csv"');
  response.send(csv);
}

export async function exportHistoryCsv(_request: Request, response: Response): Promise<void> {
  const csv = await trainerService.exportHistoryCsv();
  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", 'attachment; filename="allocation-history.csv"');
  response.send(csv);
}

export async function resetTrainerPassword(request: Request, response: Response): Promise<void> {
  const trainerId = String(request.params["id"] || "");
  const data = await trainerService.resetTrainerPassword(trainerId, getActor(request));
  response.json({ success: true, message: "Trainer password reset successfully.", data });
}

export async function getFacultyDailyAttendance(request: Request, response: Response): Promise<void> {
  const date = request.query["date"] ? String(request.query["date"]) : undefined;
  const overview = await trainerService.getFacultyAttendanceOverview(date);
  response.json({ success: true, data: overview });
}

export async function acknowledgeFacultyAbsence(request: Request, response: Response): Promise<void> {
  const { trainerId, date, backupTrainerId } = request.body;
  if (!trainerId || !date) {
    throw new HttpError(400, "BAD_REQUEST", "Trainer ID and Date are required.");
  }
  const result = await trainerService.acknowledgeFacultyAbsence(String(trainerId), String(date), backupTrainerId ? String(backupTrainerId) : undefined, getActor(request));
  response.json(result);
}

export async function managerCheckInFaculty(request: Request, response: Response): Promise<void> {
  const { trainerId } = request.body;
  if (!trainerId) {
    throw new HttpError(400, "BAD_REQUEST", "Trainer ID is required.");
  }
  const record = await trainerService.checkInTrainer(String(trainerId));
  response.json({ success: true, message: "Faculty checked in successfully and marked PRESENT!", record });
}

export async function getFacultyAttendanceHistory(request: Request, response: Response): Promise<void> {
  const { startDate, endDate, month, trainerId } = request.query;
  const result = await trainerService.getFacultyAttendanceHistory({
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
    month: month ? String(month) : undefined,
    trainerId: trainerId ? String(trainerId) : undefined,
  });
  response.json({ success: true, data: result });
}

export async function exportFacultyAttendanceCsv(request: Request, response: Response): Promise<void> {
  const { startDate, endDate, month, trainerId } = request.query;
  const csv = await trainerService.exportFacultyAttendanceCsv({
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
    month: month ? String(month) : undefined,
    trainerId: trainerId ? String(trainerId) : undefined,
  });
  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", 'attachment; filename="faculty-attendance.csv"');
  response.send(csv);
}

export async function getHolidays(_request: Request, response: Response): Promise<void> {
  const list = await trainerService.getHolidays();
  response.json({ success: true, data: list });
}

export async function createHoliday(request: Request, response: Response): Promise<void> {
  const { date, name, type, description } = request.body;
  if (!date || !name) {
    throw new HttpError(400, "BAD_REQUEST", "Date and holiday name are required.");
  }
  const result = await trainerService.createHoliday({ date, name, type, description });
  response.json({ success: true, data: result, message: "Institutional holiday added successfully." });
}

export async function deleteHoliday(request: Request, response: Response): Promise<void> {
  const id = request.params["id"];
  if (!id) throw new HttpError(400, "BAD_REQUEST", "Holiday ID is required.");
  await trainerService.deleteHoliday(String(id));
  response.json({ success: true, message: "Institutional holiday removed successfully." });
}

export async function calculateBatchSchedule(request: Request, response: Response): Promise<void> {
  const { startDate, totalSessions, days } = request.body;
  if (!startDate || !totalSessions) {
    throw new HttpError(400, "BAD_REQUEST", "Start date and total sessions are required.");
  }
  const schedule = await trainerService.calculateBatchSchedule({
    startDate: String(startDate),
    totalSessions: Number(totalSessions),
    days: Array.isArray(days) ? days : undefined,
  });
  response.json({ success: true, data: schedule });
}
