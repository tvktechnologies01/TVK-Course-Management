import { Model, Schema, model, models } from "mongoose";

export interface ResumeFileRecord {
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  candidateId: string;
  uploadedByUserId: string;
  data: Buffer;
  storageKey?: string;
}

const resumeFileSchema = new Schema<ResumeFileRecord>({
  originalName: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 1 },
  sha256: { type: String, required: true, index: true },
  candidateId: { type: String, default: "", index: true },
  uploadedByUserId: { type: String, default: "PUBLIC_REGISTRATION" },
  data: { type: Buffer, required: true, select: false },
  storageKey: { type: String, select: false },
}, { timestamps: true, versionKey: false });

resumeFileSchema.index({ candidateId: 1, createdAt: -1 });

export const ResumeFileModel: Model<ResumeFileRecord> = models["ResumeFile"] as Model<ResumeFileRecord> ?? model<ResumeFileRecord>("ResumeFile", resumeFileSchema);