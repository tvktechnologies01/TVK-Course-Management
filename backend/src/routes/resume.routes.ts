import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { deleteResume, downloadResume, uploadResume, viewResume } from "../controllers/resume.controller";
import { requireAuth } from "../middleware/require-auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxResumeSizeBytes, files: 1, fields: 10, parts: 20 },
  fileFilter(_request, file, callback) {
    const isPdfExt = file.originalname.toLowerCase().endsWith(".pdf");
    const isPdfMime = !file.mimetype || file.mimetype === "application/pdf" || file.mimetype === "application/x-pdf" || file.mimetype === "application/octet-stream";
    callback(null, isPdfExt && isPdfMime);
  },
});

export const resumeRouter = Router();
resumeRouter.use(requireAuth);
resumeRouter.post("/", upload.single("resume"), uploadResume);
resumeRouter.get("/:id/download", downloadResume);
resumeRouter.get("/:id", viewResume);
resumeRouter.delete("/:id", deleteResume);
