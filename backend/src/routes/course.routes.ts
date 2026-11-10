import { Router } from "express";
import multer from "multer";
import { HttpError } from "../middleware/error-handler";
import { requireAuth, requireRole } from "../middleware/require-auth";
import {
  createCourse,
  deleteCourse,
  deleteCurriculum,
  deleteTrackCurriculum,
  downloadCurriculum,
  downloadTrackCurriculum,
  getCandidateCurriculum,
  getCourse,
  listCourses,
  updateCourse,
  updateTrackFee,
  uploadCurriculum,
  uploadTrackCurriculum,
} from "../controllers/course.controller";

const ALLOWED_CURRICULUM_EXTS = [".pdf", ".doc", ".docx", ".ppt", ".pptx"];

const curriculumUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB limit for curriculum presentations and documents
    files: 1,
  },
  fileFilter(_request, file, callback) {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_CURRICULUM_EXTS.includes(ext)) {
      return callback(
        new HttpError(
          400,
          "INVALID_FILE_TYPE",
          "Only PDF, DOC, DOCX, and PPT/PPTX files are allowed for curriculum documents.",
        ),
      );
    }
    callback(null, true);
  },
});

export const courseRouter = Router();

// Public / Candidate view of curriculum
courseRouter.get("/candidate-curriculum", getCandidateCurriculum);
courseRouter.get("/:id/curriculum/download", downloadCurriculum);

// Authenticated Employee / Manager routes
courseRouter.use(requireAuth);

courseRouter.get("/", listCourses);
courseRouter.get("/:id", getCourse);

// Manager-only controls: create, modify, delete courses & upload curriculum
courseRouter.post("/", requireRole("MANAGER"), createCourse);
courseRouter.patch("/:id", requireRole("MANAGER"), updateCourse);
courseRouter.delete("/:id", requireRole("MANAGER"), deleteCourse);

courseRouter.post(
  "/:id/curriculum",
  requireRole("MANAGER"),
  curriculumUpload.single("curriculum"),
  uploadCurriculum,
);

courseRouter.delete("/:id/curriculum", requireRole("MANAGER"), deleteCurriculum);

// Duration Track Routes (Manager configuration & upload; HR/Public download)
courseRouter.get("/:id/tracks/:duration/curriculum/download", downloadTrackCurriculum);
courseRouter.patch("/:id/tracks/:duration", requireRole("MANAGER"), updateTrackFee);
courseRouter.post(
  "/:id/tracks/:duration/curriculum",
  requireRole("MANAGER"),
  curriculumUpload.single("curriculum"),
  uploadTrackCurriculum,
);
courseRouter.delete("/:id/tracks/:duration/curriculum", requireRole("MANAGER"), deleteTrackCurriculum);
