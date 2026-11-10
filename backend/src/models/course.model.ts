import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface CourseTrackRecord {
  duration: string;
  fees: number;
  curriculumFileId?: string | null;
  curriculumFileName?: string;
  curriculumFileType?: string;
  curriculumFileSize?: number;
  curriculumUploadedAt?: Date | null;
  curriculumUploadedBy?: string;
}

export interface CourseRecord {
  _id: string;
  name: string;
  code: string;
  category: string;
  duration: string;
  mode: string;
  fees: number;
  description: string;
  keyTopics: string[];
  status: "ACTIVE" | "INACTIVE";
  tracks?: CourseTrackRecord[];
  curriculumFileId?: string | null;
  curriculumFileName?: string;
  curriculumFileType?: string;
  curriculumFileSize?: number;
  curriculumUploadedAt?: Date | null;
  lastModifiedBy?: string;
  lastModifiedByUserId?: string;
  createdBy?: string;
  createdByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseDocument = HydratedDocument<CourseRecord>;

const courseTrackSchema = new Schema<CourseTrackRecord>({
  duration: { type: String, required: true, trim: true },
  fees: { type: Number, default: 0, min: 0 },
  curriculumFileId: { type: String, default: null },
  curriculumFileName: { type: String, default: "" },
  curriculumFileType: { type: String, default: "" },
  curriculumFileSize: { type: Number, default: 0 },
  curriculumUploadedAt: { type: Date, default: null },
  curriculumUploadedBy: { type: String, default: "" },
}, { _id: false });

const courseSchema = new Schema<CourseRecord>({
  _id: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: 200, index: true },
  code: { type: String, default: "", trim: true, maxlength: 40 },
  category: { type: String, default: "General IT", trim: true, maxlength: 100 },
  duration: { type: String, default: "3 Months", trim: true, maxlength: 40 },
  mode: { type: String, default: "Online / Offline", trim: true, maxlength: 60 },
  fees: { type: Number, default: 0, min: 0 },
  description: { type: String, default: "", maxlength: 4000 },
  keyTopics: { type: [String], default: [] },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", required: true },
  tracks: { type: [courseTrackSchema], default: [] },
  curriculumFileId: { type: String, default: null },
  curriculumFileName: { type: String, default: "" },
  curriculumFileType: { type: String, default: "" },
  curriculumFileSize: { type: Number, default: 0 },
  curriculumUploadedAt: { type: Date, default: null },
  lastModifiedBy: { type: String, default: "Administration" },
  lastModifiedByUserId: { type: String, default: "" },
  createdBy: { type: String, default: "Administration" },
  createdByUserId: { type: String, default: "" },
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_document, value: Record<string, unknown>) {
      value["id"] = value["id"] || value["_id"] || (_document as any)?._id;
      delete value["_id"];
      return value;
    },
  },
});

courseSchema.index({ status: 1, name: 1 });
courseSchema.index({ category: 1 });

export const CourseModel: Model<CourseRecord> =
  (models["Course"] as Model<CourseRecord>) ??
  model<CourseRecord>("Course", courseSchema);
