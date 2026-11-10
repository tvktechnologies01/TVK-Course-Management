import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export interface HolidayRecord {
  _id: string;
  date: string; // "YYYY-MM-DD"
  name: string; // e.g. "Diwali / Deepavali", "Pongal", "Republic Day"
  type: "GOVERNMENT" | "INSTITUTIONAL" | "FESTIVAL" | "OTHER";
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type HolidayDocument = HydratedDocument<HolidayRecord>;

const holidaySchema = new Schema<HolidayRecord>(
  {
    _id: { type: String, required: true },
    date: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ["GOVERNMENT", "INSTITUTIONAL", "FESTIVAL", "OTHER"],
      default: "GOVERNMENT",
    },
    description: { type: String, default: "", trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
  }
);

export const HolidayModel: Model<HolidayRecord> =
  (models["Holiday"] as Model<HolidayRecord>) ??
  model<HolidayRecord>("Holiday", holidaySchema);
