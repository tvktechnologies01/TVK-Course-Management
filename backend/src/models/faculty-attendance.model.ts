import { Schema, model, Document } from "mongoose";

export type FacultyAttendanceStatus = "PRESENT" | "ON_LEAVE" | "ABSENT";
export type FacultyLeaveType = "SICK" | "CASUAL" | "EMERGENCY" | "PLANNED" | "OFFICIAL";

export interface FacultyAttendanceRecord {
  id: string;
  trainerId: string;
  trainerName: string;
  trainerEmail?: string;
  date: string; // YYYY-MM-DD
  status: FacultyAttendanceStatus;
  checkInTime?: Date | null;
  isLateCheckIn?: boolean;
  isCutoffMissed?: boolean;
  leaveType?: FacultyLeaveType | null;
  leaveReason?: string | null;
  expectedReturnDate?: Date | string | null;
  handoverNotes?: string | null;
  managerAcknowledged: boolean;
  backupTrainerId?: string | null;
  backupTrainerName?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type FacultyAttendanceDocument = Document & FacultyAttendanceRecord;

const FacultyAttendanceSchema = new Schema(
  {
    _id: { type: String, required: true }, // Format: `${trainerId}_${date}`
    trainerId: { type: String, required: true, index: true },
    trainerName: { type: String, required: true },
    trainerEmail: { type: String, default: "" },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    status: {
      type: String,
      enum: ["PRESENT", "ON_LEAVE", "ABSENT"],
      default: "PRESENT",
      required: true,
      index: true,
    },
    checkInTime: { type: Date, default: null },
    isLateCheckIn: { type: Boolean, default: false },
    isCutoffMissed: { type: Boolean, default: false },
    leaveType: {
      type: String,
      enum: ["SICK", "CASUAL", "EMERGENCY", "PLANNED", "OFFICIAL"],
      default: null,
    },
    leaveReason: { type: String, default: null },
    expectedReturnDate: { type: Date, default: null },
    handoverNotes: { type: String, default: null },
    managerAcknowledged: { type: Boolean, default: false },
    backupTrainerId: { type: String, default: null },
    backupTrainerName: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

FacultyAttendanceSchema.index({ trainerId: 1, date: 1 }, { unique: true });
FacultyAttendanceSchema.index({ date: 1, status: 1 });

export const FacultyAttendanceModel = model<FacultyAttendanceDocument>(
  "FacultyAttendance",
  FacultyAttendanceSchema
);
