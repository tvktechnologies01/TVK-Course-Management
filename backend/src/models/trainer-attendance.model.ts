import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface TrainerAttendanceRecord {
  _id: string;
  batchId?: string;
  courseName: string;
  trainerId: string;
  trainerName: string;
  studentId: string;
  studentName: string;
  date: string; // YYYY-MM-DD
  status: "PRESENT" | "ABSENT" | "LATE";
  topicCovered?: string;
  remarks?: string;
  markedBy?: string;
  createdAt: Date;
}

export type TrainerAttendanceDocument = HydratedDocument<TrainerAttendanceRecord>;

const attendanceSchema = new Schema<TrainerAttendanceRecord>(
  {
    _id: { type: String, required: true },
    batchId: { type: String, default: "", index: true },
    courseName: { type: String, required: true, trim: true, index: true },
    trainerId: { type: String, required: true, index: true },
    trainerName: { type: String, required: true, trim: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    date: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["PRESENT", "ABSENT", "LATE"],
      default: "PRESENT",
      required: true,
    },
    topicCovered: { type: String, default: "", maxlength: 500 },
    remarks: { type: String, default: "", maxlength: 500 },
    markedBy: { type: String, default: "Trainer" },
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

attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

export const TrainerAttendanceModel: Model<TrainerAttendanceRecord> =
  (models["TrainerAttendance"] as Model<TrainerAttendanceRecord>) ??
  model<TrainerAttendanceRecord>("TrainerAttendance", attendanceSchema);
