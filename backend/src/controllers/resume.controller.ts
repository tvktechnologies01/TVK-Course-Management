import { pipeline } from "node:stream/promises";
import { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { resumeService } from "../services/resume.service";
import { HttpError } from "../middleware/error-handler";

export const resumeUploadFieldsSchema = z.object({
  candidateId: z.string().trim().max(120).optional(),
}).strict();

export const resumeIdParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
}).strict();

function actor(request: Request) {
  if (!request.account) throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return request.account;
}

export async function uploadResume(request: Request, response: Response): Promise<void> {
  if (!request.file) throw new HttpError(400, "RESUME_REQUIRED", "Select a PDF resume to upload.");
  const fields = resumeUploadFieldsSchema.parse(request.body);
  const uploaded = await resumeService.save(request.file, fields.candidateId, actor(request));
  response.status(201).json({ success: true, data: uploaded });
}

async function sendResume(request: Request, response: Response, disposition: "inline" | "attachment"): Promise<void> {
  const { id } = resumeIdParamSchema.parse(request.params);
  const resume = await resumeService.stream(id, actor(request));
  const safeName = encodeURIComponent(resume.filename).replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16)}`);
  const mimeType = (resume as { mimeType?: string }).mimeType || (
    resume.filename.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : resume.filename.toLowerCase().endsWith(".doc")
        ? "application/msword"
        : "application/pdf"
  );
  response.set({
    "Content-Type": mimeType,
    "Content-Disposition": `${disposition}; filename*=UTF-8''${safeName}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  await pipeline(resume.stream, response);
}

export async function viewResume(request: Request, response: Response): Promise<void> {
  await sendResume(request, response, "inline");
}

export async function downloadResume(request: Request, response: Response): Promise<void> {
  await sendResume(request, response, "attachment");
}

export async function deleteResume(request: Request, response: Response): Promise<void> {
  const { id } = resumeIdParamSchema.parse(request.params);
  await resumeService.remove(id, actor(request));
  response.status(204).end();
}

export function maximumUploadSize(): number {
  return env.maxResumeSizeBytes;
}
