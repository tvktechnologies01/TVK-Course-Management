import { Request, Response } from "express";
import { courseService } from "../services/course.service";
import { HttpError } from "../middleware/error-handler";
import { idParamSchema } from "../validators/candidate.validators";

function accountFrom(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

export async function listCourses(request: Request, response: Response): Promise<void> {
  const result = await courseService.list(request.query, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function getCourse(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await courseService.get(id);
  response.json({ success: true, data: result });
}

export async function createCourse(request: Request, response: Response): Promise<void> {
  const result = await courseService.create(request.body, accountFrom(request));
  response.status(201).json({ success: true, data: result });
}

export async function updateCourse(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await courseService.update(id, request.body, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function deleteCourse(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await courseService.delete(id, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function uploadCurriculum(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  if (!request.file) {
    throw new HttpError(400, "FILE_REQUIRED", "Attach a curriculum file (PDF, DOC, DOCX, or PPT).");
  }
  const result = await courseService.uploadCurriculum(id, request.file, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function deleteCurriculum(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const result = await courseService.deleteCurriculum(id, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function downloadCurriculum(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const duration = typeof request.query["duration"] === "string" ? request.query["duration"] : undefined;
  const { file, course, duration: matchedDuration } = await courseService.getCurriculumFile(id, duration);

  const safeCourseName = course.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeDuration = (matchedDuration || "Course").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ext = file.originalName.slice(file.originalName.lastIndexOf(".")).toLowerCase();
  const downloadName = `TVK-${safeCourseName}-${safeDuration}-Curriculum${ext}`;

  response.setHeader("Content-Type", file.mimeType);
  response.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  response.setHeader("Content-Length", file.size);
  response.send(file.data);
}

export async function updateTrackFee(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const duration = String(request.params["duration"] || "").trim();
  const fees = Number(request.body.fees) || 0;
  const result = await courseService.updateTrackFee(id, duration, fees, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function uploadTrackCurriculum(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const duration = String(request.params["duration"] || "").trim();
  if (!request.file) {
    throw new HttpError(400, "FILE_REQUIRED", "Attach a curriculum file (PDF, DOC, DOCX, or PPT).");
  }
  const result = await courseService.uploadTrackCurriculum(id, duration, request.file, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function deleteTrackCurriculum(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const duration = String(request.params["duration"] || "").trim();
  const result = await courseService.deleteTrackCurriculum(id, duration, accountFrom(request));
  response.json({ success: true, data: result });
}

export async function downloadTrackCurriculum(request: Request, response: Response): Promise<void> {
  const { id } = idParamSchema.parse(request.params);
  const duration = String(request.params["duration"] || "").trim();
  const { file, course } = await courseService.getCurriculumFile(id, duration);

  const safeCourseName = course.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeDuration = duration.replace(/[^a-zA-Z0-9_-]/g, "_");
  const ext = file.originalName.slice(file.originalName.lastIndexOf(".")).toLowerCase();
  const downloadName = `TVK-${safeCourseName}-${safeDuration}-Curriculum${ext}`;

  response.setHeader("Content-Type", file.mimeType);
  response.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  response.setHeader("Content-Length", file.size);
  response.send(file.data);
}

export async function getCandidateCurriculum(request: Request, response: Response): Promise<void> {
  const candidateCourseName = typeof request.query["courseName"] === "string" ? request.query["courseName"] : undefined;
  const candidateDuration = typeof request.query["duration"] === "string" ? request.query["duration"] : undefined;
  const result = await courseService.getCurriculumForCandidateCourse(candidateCourseName, candidateDuration);
  response.json({ success: true, data: result });
}
