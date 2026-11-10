import { Model, Schema, model, models } from "mongoose";

export interface AssignmentHistoryRecord {
  candidateId: string;
  candidateName: string;
  previousAssigneeId: string | null;
  previousAssigneeName: string | null;
  assignedToId: string;
  assignedToName: string;
  assignedByUserId: string;
  assignedByName: string;
  assignedAt: Date;
  action?: string;
  reason?: string;
}

const assignmentHistorySchema = new Schema<AssignmentHistoryRecord>({
  candidateId: { type: String, required: true, index: true },
  candidateName: { type: String, required: true },
  previousAssigneeId: { type: String, default: null },
  previousAssigneeName: { type: String, default: null },
  assignedToId: { type: String, required: true },
  assignedToName: { type: String, required: true },
  assignedByUserId: { type: String, required: true },
  assignedByName: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now, required: true },
  action: { type: String, default: "ASSIGNED" },
  reason: { type: String, default: "" },
}, { timestamps: true, versionKey: false });

assignmentHistorySchema.index({ candidateId: 1, assignedAt: -1 });
assignmentHistorySchema.index({ assignedToId: 1, assignedAt: -1 });

export const AssignmentHistoryModel: Model<AssignmentHistoryRecord> = models["AssignmentHistory"] as Model<AssignmentHistoryRecord> ?? model<AssignmentHistoryRecord>("AssignmentHistory", assignmentHistorySchema);
