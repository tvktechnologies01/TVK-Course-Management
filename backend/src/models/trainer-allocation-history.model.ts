import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export const TRAINER_ALLOCATION_ACTIONS = [
  "INITIAL_ALLOCATION",
  "REASSIGNMENT",
  "ABSENCE_REASSIGNMENT",
  "AUTO_ALLOCATION",
  "DEALLOCATION",
] as const;

export type TrainerAllocationAction = typeof TRAINER_ALLOCATION_ACTIONS[number];

export interface TrainerAllocationHistoryRecord {
  _id: string;
  studentId: string; // Candidate ID (e.g. TVK-26-00001)
  studentName: string;
  courseName: string;
  previousTrainerId: string | null;
  previousTrainerName: string | null;
  newTrainerId: string | null;
  newTrainerName: string | null;
  action: TrainerAllocationAction;
  reason?: string;
  updatedBy: string;
  updatedByUserId?: string;
  allocatedAt: Date;
}

export type TrainerAllocationHistoryDocument = HydratedDocument<TrainerAllocationHistoryRecord>;

const historySchema = new Schema<TrainerAllocationHistoryRecord>(
  {
    _id: { type: String, required: true },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    courseName: { type: String, required: true, trim: true, index: true },
    previousTrainerId: { type: String, default: null },
    previousTrainerName: { type: String, default: null },
    newTrainerId: { type: String, default: null, index: true },
    newTrainerName: { type: String, default: null },
    action: {
      type: String,
      enum: TRAINER_ALLOCATION_ACTIONS,
      default: "INITIAL_ALLOCATION",
      required: true,
      index: true,
    },
    reason: { type: String, default: "", maxlength: 1000 },
    updatedBy: { type: String, default: "Manager" },
    updatedByUserId: { type: String, default: "" },
    allocatedAt: { type: Date, default: Date.now, index: true },
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

historySchema.index({ allocatedAt: -1 });

export const TrainerAllocationHistoryModel: Model<TrainerAllocationHistoryRecord> =
  (models["TrainerAllocationHistory"] as Model<TrainerAllocationHistoryRecord>) ??
  model<TrainerAllocationHistoryRecord>("TrainerAllocationHistory", historySchema);
