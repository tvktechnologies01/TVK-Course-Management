import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface BackupTrainerRecord {
  trainerId: string;
  trainerName: string;
}

export interface CourseTrainerRecord {
  _id: string; // Course ID or unique allocation ID
  courseId: string;
  courseName: string;
  primaryTrainerId: string | null;
  primaryTrainerName: string | null;
  backupTrainers: BackupTrainerRecord[];
  notes?: string;
  allocatedBy?: string;
  allocatedByUserId?: string;
  allocatedAt: Date;
  updatedAt: Date;
}

export type CourseTrainerDocument = HydratedDocument<CourseTrainerRecord>;

const backupTrainerSchema = new Schema<BackupTrainerRecord>(
  {
    trainerId: { type: String, required: true },
    trainerName: { type: String, required: true },
  },
  { _id: false }
);

const courseTrainerSchema = new Schema<CourseTrainerRecord>(
  {
    _id: { type: String, required: true },
    courseId: { type: String, required: true, index: true },
    courseName: { type: String, required: true, trim: true, index: true },
    primaryTrainerId: { type: String, default: null },
    primaryTrainerName: { type: String, default: null },
    backupTrainers: { type: [backupTrainerSchema], default: [] },
    notes: { type: String, default: "", maxlength: 1000 },
    allocatedBy: { type: String, default: "Manager" },
    allocatedByUserId: { type: String, default: "" },
    allocatedAt: { type: Date, default: Date.now },
  },
  {
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
  }
);

courseTrainerSchema.index({ primaryTrainerId: 1 });

export const CourseTrainerModel: Model<CourseTrainerRecord> =
  (models["CourseTrainer"] as Model<CourseTrainerRecord>) ??
  model<CourseTrainerRecord>("CourseTrainer", courseTrainerSchema);
