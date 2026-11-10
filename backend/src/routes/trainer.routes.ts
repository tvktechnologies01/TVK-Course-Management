import { Router } from "express";
import {
  getOverview,
  getTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  toggleTrainerStatus,
  getCourseAllocations,
  setCourseAllocation,
  removeCourseAllocation,
  getEligibleStudents,
  allocateStudent,
  allocateBulkStudents,
  updateAvailability,
  getAbsenceImpact,
  reassignAbsenceStudents,
  previewAutoAllocation,
  applyAutoAllocation,
  getAllocationHistory,
  getBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  markAttendance,
  getAttendance,
  getStudentTrainingSummary,
  saveStudentScorecard,
  getStudentScorecards,
  submitTrainerFeedback,
  getTrainerFeedback,
  exportTrainersCsv,
  exportAllocationsCsv,
  exportHistoryCsv,
  resetTrainerPassword,
  getFacultyDailyAttendance,
  acknowledgeFacultyAbsence,
  managerCheckInFaculty,
  getFacultyAttendanceHistory,
  exportFacultyAttendanceCsv,
  getHolidays,
  createHoliday,
  deleteHoliday,
  calculateBatchSchedule,
} from "../controllers/trainer.controller";
import { requireAuth, requireRole } from "../middleware/require-auth";

export const trainerRouter = Router();

// Protect all trainer routes with Manager role (except feedback submission if candidate calls it)
trainerRouter.use(requireAuth, requireRole("MANAGER"));

// Overview
trainerRouter.get("/overview", getOverview);

// Exports
trainerRouter.get("/export/trainers", exportTrainersCsv);
trainerRouter.get("/export/allocations", exportAllocationsCsv);
trainerRouter.get("/export/history", exportHistoryCsv);

// Batches & Schedules
trainerRouter.get("/batches", getBatches);
trainerRouter.post("/batches", createBatch);
trainerRouter.post("/batches/calculate-schedule", calculateBatchSchedule);
trainerRouter.put("/batches/:id", updateBatch);
trainerRouter.patch("/batches/:id", updateBatch);
trainerRouter.delete("/batches/:id", deleteBatch);

// Institutional Holidays Master
trainerRouter.get("/holidays", getHolidays);
trainerRouter.post("/holidays", createHoliday);
trainerRouter.delete("/holidays/:id", deleteHoliday);

// Attendance
trainerRouter.get("/attendance", getAttendance);
trainerRouter.post("/attendance", markAttendance);

// Performance & Scorecards
trainerRouter.get("/scorecards", getStudentScorecards);
trainerRouter.post("/scorecards", saveStudentScorecard);

// Feedback & Ratings
trainerRouter.get("/feedback/:trainerId", getTrainerFeedback);
trainerRouter.post("/feedback", submitTrainerFeedback);

// Course Allocations (placed before /:id to avoid route shadowing)
trainerRouter.get("/courses/allocations", getCourseAllocations);
trainerRouter.post("/courses/:courseId/allocation", setCourseAllocation);
trainerRouter.delete("/courses/:courseId/allocation", removeCourseAllocation);

// Student Allocations
trainerRouter.get("/students/eligible", getEligibleStudents);
trainerRouter.get("/students/:studentId/summary", getStudentTrainingSummary);
trainerRouter.post("/students/:studentId/allocate", allocateStudent);
trainerRouter.post("/students/bulk-allocate", allocateBulkStudents);

// Auto Allocation
trainerRouter.get("/auto-allocate/preview", previewAutoAllocation);
trainerRouter.post("/auto-allocate/apply", applyAutoAllocation);

// History
trainerRouter.get("/history/list", getAllocationHistory);

// Faculty Daily Attendance & Manager Alerts
trainerRouter.get("/faculty-attendance/overview", getFacultyDailyAttendance);
trainerRouter.get("/faculty-attendance/history", getFacultyAttendanceHistory);
trainerRouter.get("/faculty-attendance/export-csv", exportFacultyAttendanceCsv);
trainerRouter.post("/faculty-attendance/acknowledge", acknowledgeFacultyAbsence);
trainerRouter.post("/faculty-attendance/check-in", managerCheckInFaculty);

// Trainer CRUD & Detail routes
trainerRouter.get("/", getTrainers);
trainerRouter.post("/", createTrainer);
trainerRouter.get("/:id", getTrainerById);
trainerRouter.put("/:id", updateTrainer);
trainerRouter.patch("/:id", updateTrainer);
trainerRouter.patch("/:id/status", toggleTrainerStatus);
trainerRouter.patch("/:id/availability", updateAvailability);
trainerRouter.get("/:id/absence-impact", getAbsenceImpact);
trainerRouter.post("/:id/absence-reassign", reassignAbsenceStudents);
trainerRouter.post("/:id/reset-password", resetTrainerPassword);
