import { randomUUID } from "node:crypto";
import { Model, Schema, model, models } from "mongoose";

export interface FollowUpRecord {
  _id: string;
  candidateId: string;
  candidateName: string;
  scheduledAt: Date;
  notes: string;
  completed: boolean;
  createdBy: string;
  createdByUserId: string;
}

const followUpSchema = new Schema<FollowUpRecord>({
  _id: { type: String, default: () => randomUUID() },
  candidateId: { type: String, required: true },
  candidateName: { type: String, required: true, trim: true },
  scheduledAt: { type: Date, required: true },
  notes: { type: String, default: "", maxlength: 4000 },
  completed: { type: Boolean, default: false, required: true },
  createdBy: { type: String, required: true },
  createdByUserId: { type: String, required: true },
}, { timestamps: true, versionKey: false });

followUpSchema.index({ candidateId: 1, scheduledAt: 1 });
followUpSchema.index({ completed: 1, scheduledAt: 1 });

export const FollowUpModel: Model<FollowUpRecord> = models["FollowUp"] as Model<FollowUpRecord> ?? model<FollowUpRecord>("FollowUp", followUpSchema);