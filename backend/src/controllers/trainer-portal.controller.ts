import { Request, Response } from "express";
import { trainerService } from "../services/trainer.service";
import { HttpError } from "../middleware/error-handler";

export async function trainerPortalLogin(request: Request, response: Response): Promise<void> {
  const { identifier, password } = request.body;
  if (!identifier || !password) {
    throw new HttpError(400, "BAD_REQUEST", "Please provide both Trainer ID / Email and Password.");
  }

  const result = await trainerService.trainerLogin(String(identifier), String(password));
  response.json({ success: true, data: result });
}

export async function trainerPortalChangePassword(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const { currentPassword, newPassword } = request.body;
  if (!currentPassword || !newPassword) {
    throw new HttpError(400, "BAD_REQUEST", "Provide current password and new password.");
  }

  await trainerService.trainerChangePassword(trainerId, String(currentPassword), String(newPassword));
  response.json({ success: true, message: "Password updated successfully." });
}

export async function getTrainerPortalMe(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const data = await trainerService.getTrainerPortalProfile(trainerId);
  response.json({ success: true, data });
}

export async function recordTrainerPortalAttendance(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const { records } = request.body;
  if (!Array.isArray(records) || records.length === 0) {
    throw new HttpError(400, "BAD_REQUEST", "Please provide a valid list of attendance records.");
  }

  // Ensure each record is tied to this trainer
  const sanitizedRecords = records.map((r: any) => ({
    ...r,
    trainerId,
  }));

  await trainerService.markAttendance(sanitizedRecords);
  response.json({ success: true, message: `Successfully recorded attendance for ${records.length} candidate(s).`, count: records.length });
}

export async function getTrainerPortalAttendance(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const { batchId, studentId, date, month, courseName } = request.query;

  const records = await trainerService.getAttendance({
    trainerId,
    batchId: batchId ? String(batchId) : undefined,
    studentId: studentId ? String(studentId) : undefined,
    date: date ? String(date) : undefined,
    month: month ? String(month) : undefined,
    courseName: courseName ? String(courseName) : undefined,
  });

  response.json({ success: true, data: records });
}

export async function getTrainerPortalStudentSummary(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const studentId = String(request.params["studentId"] || "");
  if (!studentId) {
    throw new HttpError(400, "BAD_REQUEST", "Student ID is required.");
  }

  const summary = await trainerService.getStudentTrainingSummary(studentId);
  response.json({ success: true, data: summary });
}

export async function saveTrainerPortalScorecard(request: Request, response: Response): Promise<void> {
  const trainer = request.trainerUser;
  if (!trainer?.trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const { studentId, technicalScore, problemSolvingScore, communicationScore, readinessStatus, feedback, recommendedRole } = request.body;

  if (!studentId || technicalScore === undefined || problemSolvingScore === undefined || communicationScore === undefined || !readinessStatus) {
    throw new HttpError(400, "BAD_REQUEST", "All scorecard fields (technical, problem solving, communication, readiness) are required.");
  }

  const scorecard = await trainerService.saveStudentScorecard(
    {
      studentId: String(studentId),
      technicalScore: Number(technicalScore),
      problemSolvingScore: Number(problemSolvingScore),
      communicationScore: Number(communicationScore),
      readinessStatus,
      feedback: feedback || "",
      recommendedRole,
    },
    {
      id: trainer.trainerId,
      name: trainer.name || "Trainer",
      username: trainer.email,
      email: trainer.email,
      employeeId: trainer.trainerId,
      role: "TRAINER" as any,
      active: true,
      mustChangePassword: false,
    }
  );

  response.status(201).json({ success: true, data: scorecard, message: "Assessment scorecard saved successfully." });
}

export async function getTrainerPortalScorecards(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const { studentId, courseName } = request.query;
  const scorecards = await trainerService.getStudentScorecards(
    studentId ? String(studentId) : undefined,
    courseName ? String(courseName) : undefined,
    trainerId
  );

  response.json({ success: true, data: scorecards });
}

export async function submitTrainerPortalAbsence(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const { absenceReason, absenceStartDate, expectedReturnDate, leaveType, handoverNotes } = request.body;
  if (!absenceReason) {
    throw new HttpError(400, "BAD_REQUEST", "Please provide a reason for the absence/leave.");
  }

  const startDateStr = absenceStartDate ? String(absenceStartDate).substring(0, 10) : new Date().toISOString().split("T")[0];
  const endDateStr = expectedReturnDate ? String(expectedReturnDate).substring(0, 10) : undefined;

  const result = await trainerService.submitTrainerLeaveWithReason(trainerId, {
    startDate: startDateStr,
    endDate: endDateStr,
    leaveType: leaveType || "CASUAL",
    reason: String(absenceReason),
    handoverNotes: handoverNotes ? String(handoverNotes) : undefined,
  });

  response.json(result);
}

export async function trainerPortalCheckIn(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const record = await trainerService.checkInTrainer(trainerId);
  response.json({ success: true, data: record, message: "Checked in successfully! Marked as Present for today." });
}

export async function getTrainerPortalOwnAttendance(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const { month, startDate, endDate } = request.query;
  const result = await trainerService.getTrainerOwnAttendance(trainerId, {
    month: month ? String(month) : undefined,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
  });
  response.json({ success: true, data: result });
}

export async function resumeTrainerPortalWork(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }

  const updated = await trainerService.updateAvailability(trainerId, {
    availability: "AVAILABLE",
    actualReturnDate: new Date(),
  });

  response.json({ success: true, data: updated, message: "Welcome back! Your status is now Available." });
}

export async function exportTrainerPortalOwnAttendanceCsv(request: Request, response: Response): Promise<void> {
  const trainerId = request.trainerUser?.trainerId;
  if (!trainerId) {
    throw new HttpError(401, "UNAUTHENTICATED", "Trainer authentication required.");
  }
  const { month, startDate, endDate } = request.query;
  const csv = await trainerService.exportFacultyAttendanceCsv({
    trainerId,
    month: month ? String(month) : undefined,
    startDate: startDate ? String(startDate) : undefined,
    endDate: endDate ? String(endDate) : undefined,
  });
  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", `attachment; filename="my-attendance-${trainerId}.csv"`);
  response.send(csv);
}

export async function getTrainerPortalHolidays(_request: Request, response: Response): Promise<void> {
  const holidays = await trainerService.getHolidays();
  response.json({ success: true, data: holidays });
}
