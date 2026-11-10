import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface TrainerBatchRecord {
  _id: string; // e.g. "BATCH-JAVA-01" or UUID
  batchName: string;
  courseId?: string;
  courseName: string;
  trainerId: string;
  trainerName: string;
  timeSlot: string; // e.g. "09:00 AM - 11:00 AM"
  days: string[]; // e.g. ["Mon", "Wed", "Fri"]
  meetingLink?: string; // Google Meet / Zoom link
  classroomLocation?: string; // Room 101 or Online
  startDate: Date;
  endDate?: Date | null;
  totalSessions?: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  studentIds: string[];
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TrainerBatchDocument = HydratedDocument<TrainerBatchRecord>;

const trainerBatchSchema = new Schema<TrainerBatchRecord>(
  {
    _id: { type: String, required: true },
    batchName: { type: String, required: true, trim: true, maxlength: 160 },
    courseId: { type: String, default: "" },
    courseName: { type: String, required: true, trim: true, index: true },
    trainerId: { type: String, required: true, index: true },
    trainerName: { type: String, required: true, trim: true },
    timeSlot: { type: String, default: "10:00 AM - 12:00 PM", trim: true },
    days: { type: [String], default: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
    meetingLink: { type: String, default: "", trim: true, maxlength: 500 },
    classroomLocation: { type: String, default: "Online Interactive", trim: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    totalSessions: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["UPCOMING", "ACTIVE", "COMPLETED"],
      default: "ACTIVE",
      index: true,
    },
    studentIds: { type: [String], default: [] },
    notes: { type: String, default: "", maxlength: 1000 },
    createdBy: { type: String, default: "Manager" },
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

export const TrainerBatchModel: Model<TrainerBatchRecord> =
  (models["TrainerBatch"] as Model<TrainerBatchRecord>) ??
  model<TrainerBatchRecord>("TrainerBatch", trainerBatchSchema);
