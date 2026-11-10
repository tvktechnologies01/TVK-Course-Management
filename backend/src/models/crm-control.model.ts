import { Model, Schema, model, models } from "mongoose";

export interface CrmControlRecord {
  key: string;
  isRunning: boolean;
  value?: string;
  updatedBy: string;
  updatedAt: Date;
}

const crmControlSchema = new Schema<CrmControlRecord>(
  {
    key: { type: String, required: true, unique: true },
    isRunning: { type: Boolean, default: true },
    value: { type: String, default: "" },
    updatedBy: { type: String, default: "SYSTEM" },
  },
  {
    timestamps: true,
  },
);

export const CrmControlModel: Model<CrmControlRecord> =
  (models["CrmControl"] as Model<CrmControlRecord>) ??
  model<CrmControlRecord>("CrmControl", crmControlSchema);
