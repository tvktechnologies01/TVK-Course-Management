import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  trainerPortalLogin,
  trainerPortalChangePassword,
  getTrainerPortalMe,
  recordTrainerPortalAttendance,
  getTrainerPortalAttendance,
  getTrainerPortalStudentSummary,
  saveTrainerPortalScorecard,
  getTrainerPortalScorecards,
  submitTrainerPortalAbsence,
  resumeTrainerPortalWork,
  trainerPortalCheckIn,
  getTrainerPortalOwnAttendance,
  exportTrainerPortalOwnAttendanceCsv,
  getTrainerPortalHolidays,
} from "../controllers/trainer-portal.controller";
import { requireTrainerAuth } from "../middleware/trainer-auth";

const trainerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." },
  },
});

export const trainerPortalRouter = Router();

// Public Authentication
trainerPortalRouter.post("/login", trainerLoginLimiter, trainerPortalLogin);

// Authenticated Trainer Routes
trainerPortalRouter.use(requireTrainerAuth);
trainerPortalRouter.get("/me", getTrainerPortalMe);
trainerPortalRouter.post("/change-password", trainerPortalChangePassword);

// Attendance
trainerPortalRouter.get("/attendance", getTrainerPortalAttendance);
trainerPortalRouter.post("/attendance", recordTrainerPortalAttendance);
trainerPortalRouter.get("/student-summary/:studentId", getTrainerPortalStudentSummary);

// Student Scorecards / Assessments
trainerPortalRouter.get("/scorecards", getTrainerPortalScorecards);
trainerPortalRouter.post("/scorecards", saveTrainerPortalScorecard);

// Leave & Absence & Check-In
trainerPortalRouter.post("/check-in", trainerPortalCheckIn);
trainerPortalRouter.get("/my-attendance", getTrainerPortalOwnAttendance);
trainerPortalRouter.get("/my-attendance/export-csv", exportTrainerPortalOwnAttendanceCsv);
trainerPortalRouter.post("/absence", submitTrainerPortalAbsence);
trainerPortalRouter.post("/resume-work", resumeTrainerPortalWork);

// Institutional Holidays Reference
trainerPortalRouter.get("/holidays", getTrainerPortalHolidays);
