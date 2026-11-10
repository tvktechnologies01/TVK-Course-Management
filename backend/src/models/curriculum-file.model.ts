import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface CurriculumFileRecord {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  courseId: string;
  uploadedByUserId: string;
  uploadedByName: string;
  data: Buffer;
  createdAt: Date;
}

export type CurriculumFileDocument = HydratedDocument<CurriculumFileRecord>;

const curriculumFileSchema = new Schema<CurriculumFileRecord>({
  originalName: { type: String, required: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  courseId: { type: String, required: true, index: true },
  uploadedByUserId: { type: String, required: true },
  uploadedByName: { type: String, required: true, default: "Manager" },
  data: { type: Buffer, required: true },
}, {
  timestamps: true,
  versionKey: false,
});

export const CurriculumFileModel: Model<CurriculumFileRecord> =
  (models["CurriculumFile"] as Model<CurriculumFileRecord>) ??
  model<CurriculumFileRecord>("CurriculumFile", curriculumFileSchema);
