import { randomUUID } from "node:crypto";
import { Model, Schema, model, models } from "mongoose";

export interface ActivityLogRecord {
  _id: string;
  candidateId: string;
  candidateName: string;
  type: string;
  message: string;
  performedBy: string;
  performedByUserId: string;
}

const activityLogSchema = new Schema<ActivityLogRecord>({
  _id: { type: String, default: () => randomUUID() },
  candidateId: { type: String, default: "", index: true },
  candidateName: { type: String, default: "", trim: true },
  type: { type: String, required: true, trim: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 8000 },
  performedBy: { type: String, required: true, trim: true },
  performedByUserId: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

activityLogSchema.index({ candidateId: 1, createdAt: -1 });
activityLogSchema.index({ performedByUserId: 1, createdAt: -1 });
activityLogSchema.index({ type: 1, createdAt: -1 });

export const ActivityLogModel: Model<ActivityLogRecord> = models["ActivityLog"] as Model<ActivityLogRecord> ?? model<ActivityLogRecord>("ActivityLog", activityLogSchema);