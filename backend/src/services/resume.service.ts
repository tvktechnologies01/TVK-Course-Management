import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { ResumeFileModel } from "../models/resume-file.model";
import { CandidateModel } from "../models/candidate.model";
import { AuthenticatedAccount } from "../models/user.model";
import { HttpError } from "../middleware/error-handler";

export class ResumeService {
  async save(file: Express.Multer.File, candidateId: string | undefined, actor: AuthenticatedAccount) {
    const isPdfExt = file.originalname.toLowerCase().endsWith(".pdf");
    const isPdfMime = !file.mimetype || file.mimetype === "application/pdf" || file.mimetype === "application/x-pdf" || file.mimetype === "application/octet-stream";
    if (!isPdfExt || !isPdfMime) {
      if (file.path) await this.removeTemp(file.path);
      throw new HttpError(400, "RESUME_TYPE_INVALID", "Only PDF resumes are accepted.");
    }

    const content = file.buffer ?? (file.path ? await readFile(file.path) : Buffer.alloc(0));
    if (!content.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      if (file.path) await this.removeTemp(file.path);
      throw new HttpError(400, "RESUME_CONTENT_INVALID", "The uploaded file is not a valid PDF.");
    }

    if (candidateId) {
      const candidate = await CandidateModel.findById(candidateId);
      if (!candidate || (actor.role === "HR" && candidate.assignedToId !== actor.employeeId)) {
        if (file.path) await this.removeTemp(file.path);
        throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate not found.");
      }
    }

    const safeName = pathSafeName(file.originalname);

    try {
      const record = await ResumeFileModel.create({
        originalName: safeName,
        mimeType: "application/pdf",
        size: file.size || content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
        candidateId: candidateId ?? "",
        uploadedByUserId: actor.id,
        data: content,
      });

      if (file.path) await this.removeTemp(file.path);
      return { fileId: record.id, fileName: record.originalName, size: record.size };
    } catch (error: unknown) {
      if (file.path) await this.removeTemp(file.path);
      throw error;
    }
  }

  async stream(id: string, actor: AuthenticatedAccount) {
    const resume = await ResumeFileModel.findById(id).select("+data");
    if (!resume || !resume.data) throw new HttpError(404, "RESUME_NOT_FOUND", "Resume not found.");
    if (resume.candidateId) {
      const candidate = await CandidateModel.findById(resume.candidateId);
      if (!candidate || (actor.role === "HR" && candidate.assignedToId !== actor.employeeId)) {
        throw new HttpError(404, "RESUME_NOT_FOUND", "Resume not found.");
      }
    } else if (actor.role !== "MANAGER" && resume.uploadedByUserId !== actor.id && resume.uploadedByUserId !== "PUBLIC_REGISTRATION") {
      throw new HttpError(404, "RESUME_NOT_FOUND", "Resume not found.");
    }
    return { filename: resume.originalName, mimeType: resume.mimeType, stream: Readable.from(resume.data) };
  }

  async streamCandidateResume(candidateId: string, requestedResumeFileId?: string) {
    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) throw new HttpError(404, "CANDIDATE_NOT_FOUND", "Candidate record not found.");

    const fileId = requestedResumeFileId || candidate.resumeFileId;
    if (!fileId) throw new HttpError(404, "RESUME_NOT_FOUND", "No resume document attached to this candidate profile.");

    // Strict ownership validation: candidate can only access their own resume
    if (candidate.resumeFileId && candidate.resumeFileId !== fileId) {
      throw new HttpError(403, "FORBIDDEN", "You are not authorized to access another candidate's resume.");
    }

    const resume = await ResumeFileModel.findById(fileId).select("+data");
    if (!resume || !resume.data) throw new HttpError(404, "RESUME_NOT_FOUND", "Resume file not found.");

    if (resume.candidateId && resume.candidateId !== candidate.id && resume.candidateId !== String(candidate._id)) {
      throw new HttpError(403, "FORBIDDEN", "You are not authorized to access another candidate's resume.");
    }

    return { filename: resume.originalName, mimeType: resume.mimeType, stream: Readable.from(resume.data) };
  }

  async remove(id: string, actor: AuthenticatedAccount): Promise<void> {
    if (actor.role !== "MANAGER") throw new HttpError(403, "FORBIDDEN", "Only Managers can delete resumes.");
    const resume = await ResumeFileModel.findById(id);
    if (!resume) throw new HttpError(404, "RESUME_NOT_FOUND", "Resume not found.");
    if (resume.candidateId) {
      const candidate = await CandidateModel.findById(resume.candidateId);
      if (candidate && candidate.status !== "ARCHIVED") throw new HttpError(409, "RESUME_RETENTION", "Archive the candidate before deleting the resume.");
    }
    await resume.deleteOne();
  }

  private async removeTemp(filePath: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    await unlink(filePath).catch(() => undefined);
  }
}

function pathSafeName(originalName: string): string {
  return originalName.replace(/[\\/\u0000-\u001f]/g, "_").slice(-255);
}

export const resumeService = new ResumeService();